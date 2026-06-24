/**
 * 回合制战斗纯逻辑 - 状态机驱动（多敌人 + 目标选择 + 怪物AI）
 * 状态推进：runTurn(state, hero, action) → newState（纯函数，无副作用）
 *
 * 支持机制：
 *   控制：眩晕/麻痹/冰冻/减速
 *   DOT：流血/燃烧/毒素（可叠加）
 *   防御：护盾/格挡/减伤/不屈/嘲讽
 *   进攻：破甲/穿透/连锁多目标/蓄力/反伤/吸血/反弹
 *   元素：火焰/冰霜/闪电/毒素/暗影/神圣
 *   辅助：怒气回复/生命回复/资源回复
 *   目标：单体/连锁/多选/AOE/自身
 *   AI：效用评分制
 */

import type {
  Hero, Skill, SkillEffect, SkillEffectKind,
  TurnState, TurnAction, TurnLogEntry, TurnBuff, BuffKind,
  LevelDef, Resources, LearnedTalents, TalentNode,
  DerivedStats, DamageInstance, ElementKind,
  EnemyCombatState,
} from '../types';
import { GAME_BALANCE } from '../constants/balance';
import { WARRIOR_TALENT_TREE, TALENT_NODE_MAP } from '../constants/talents';
import { SKILL_MAP } from '../constants/skills';
import { MONSTER_TEMPLATES } from '../constants/monsters';
import { LEVELS } from '../constants/levels';
import { calcDamage, calcHeroDerived } from './combat';
import { generateEquipment } from './loot';
import { scaleMonster } from './monsterScale';
import { selectMonsterSkill } from './monsterAI';

// ─── 天赋节点查询 ─────────────────────────────────────

function allTalentNodes(): TalentNode[] {
  return WARRIOR_TALENT_TREE.nodes;
}

/** 累计已投入点数（所有节点） */
export function totalSpent(learned: LearnedTalents): number {
  return allTalentNodes().reduce((sum, n) => sum + (learned[n.id] || 0), 0);
}

// ─── 技能修饰符聚合（天赋扩展节点） ─────────────────────

interface SkillModifierAggregate {
  addedEffects: SkillEffect[];
  addedSelfEffects: SkillEffect[];
  removedKinds: SkillEffectKind[];
  damageBoost: number;
  rageReduce: number;
}

const SELF_EFFECT_KINDS: SkillEffectKind[] = [
  'shield', 'heal', 'def_up', 'atk_up', 'taunt', 'indomitable', 'rage_gain', 'counter',
];

function emptyModAgg(): SkillModifierAggregate {
  return { addedEffects: [], addedSelfEffects: [], removedKinds: [], damageBoost: 0, rageReduce: 0 };
}

export function collectSkillModifiers(learned: LearnedTalents): Record<string, SkillModifierAggregate> {
  const map: Record<string, SkillModifierAggregate> = {};
  for (const node of allTalentNodes()) {
    const rank = learned[node.id] || 0;
    if (rank <= 0 || node.kind !== 'upgrade' || !node.parentSkillId || !node.modifiers) continue;
    const agg = map[node.parentSkillId] || (map[node.parentSkillId] = emptyModAgg());
    for (const m of node.modifiers) {
      switch (m.kind) {
        case 'add_effect':
          if (SELF_EFFECT_KINDS.includes(m.effect.kind)) agg.addedSelfEffects.push(m.effect);
          else agg.addedEffects.push(m.effect);
          break;
        case 'remove_effect':
          agg.removedKinds.push(m.effectKind);
          break;
        case 'skill_damage_boost':
          agg.damageBoost += m.multiplier;
          break;
        case 'skill_rage_cost_reduce':
          agg.rageReduce += m.reduce;
          break;
      }
    }
  }
  return map;
}

function mergeEffects(effects: SkillEffect[]): SkillEffect[] {
  const grouped = new Map<SkillEffectKind, SkillEffect>();
  for (const e of effects) {
    const existing = grouped.get(e.kind);
    if (!existing) {
      grouped.set(e.kind, { ...e });
    } else {
      grouped.set(e.kind, {
        kind: e.kind,
        chance: (existing.chance ?? 0) + (e.chance ?? 0) || undefined,
        value: (existing.value ?? 0) + (e.value ?? 0) || undefined,
        duration: Math.max(existing.duration ?? 0, e.duration ?? 0) || undefined,
        extraHits: (existing.extraHits ?? 0) + (e.extraHits ?? 0) || undefined,
      });
    }
  }
  return [...grouped.values()];
}

export function getEffectiveSkill(skill: Skill, learned: LearnedTalents): Skill {
  const mods = collectSkillModifiers(learned)[skill.id];
  if (!mods) return skill;
  const baseEffects = (skill.effects || []).filter(e => !mods.removedKinds.includes(e.kind));
  const baseSelf = (skill.selfEffects || []).filter(e => !mods.removedKinds.includes(e.kind));
  return {
    ...skill,
    effects: mergeEffects([...baseEffects, ...mods.addedEffects]),
    selfEffects: mergeEffects([...baseSelf, ...mods.addedSelfEffects]),
    damageMultiplier: skill.damageMultiplier * (1 + mods.damageBoost),
    rageCost: Math.max(0, skill.rageCost - mods.rageReduce),
  };
}

// ─── 有效二级属性（受 buff 影响） ───────────────────────

function getEffectiveDerived(derived: DerivedStats, buffs: TurnBuff[]): DerivedStats {
  const r = { ...derived };
  for (const b of buffs) {
    switch (b.kind) {
      case 'curse':
        r.physicalAttack *= (1 - GAME_BALANCE.CURSE_STAT_REDUCTION);
        r.rangedAttack *= (1 - GAME_BALANCE.CURSE_STAT_REDUCTION);
        r.magicAttack *= (1 - GAME_BALANCE.CURSE_STAT_REDUCTION);
        r.armor *= (1 - GAME_BALANCE.CURSE_STAT_REDUCTION);
        r.magicResist *= (1 - GAME_BALANCE.CURSE_STAT_REDUCTION);
        r.speed *= (1 - GAME_BALANCE.CURSE_STAT_REDUCTION);
        break;
      case 'atk_up':
        r.physicalAttack *= (1 + b.value);
        r.rangedAttack *= (1 + b.value);
        r.magicAttack *= (1 + b.value);
        break;
      case 'atk_down':
        r.physicalAttack *= (1 - b.value);
        r.rangedAttack *= (1 - b.value);
        r.magicAttack *= (1 - b.value);
        break;
      case 'def_up':
        r.armor *= (1 + b.value);
        r.magicResist *= (1 + b.value);
        break;
      case 'def_down':
        r.armor *= (1 - b.value);
        r.magicResist *= (1 - b.value);
        break;
      case 'slow':
        r.speed *= (1 - GAME_BALANCE.SLOW_SPEED_REDUCTION);
        break;
    }
  }
  return r;
}

// ─── 状态初始化 ─────────────────────────────────────────

export function calcHeroMaxHp(hero: Hero): number {
  return calcHeroDerived(hero).maxHp;
}

export function initTurnState(hero: Hero, level: LevelDef, waveIndex = 0): TurnState {
  const wave = level.waves[waveIndex];
  const heroDerived = calcHeroDerived(hero);
  const maxHp = heroDerived.maxHp;
  const maxRage = heroDerived.maxResource;

  // 从波次定义生成敌人实例
  const enemies: EnemyCombatState[] = wave.monsters.map(m => {
    const template = MONSTER_TEMPLATES[m.templateId];
    if (!template) {
      throw new Error(`Monster template not found: ${m.templateId}`);
    }
    return scaleMonster(template, m.level);
  });

  // 先攻判定（取最快敌人比较）
  const fastestEnemySpeed = enemies.length > 0
    ? Math.max(...enemies.map(e => e.derived.speed))
    : 0;
  const heroSpeed = heroDerived.speed;
  const heroFirst = heroSpeed >= fastestEnemySpeed
    ? Math.random() < 0.6
    : Math.random() < 0.4;

  return {
    phase: heroFirst ? 'player' : 'enemy',
    heroHp: maxHp,
    heroMaxHp: maxHp,
    heroRage: 0,
    heroMaxRage: maxRage,
    heroDefending: false,
    heroShield: 0,
    heroChargeBonus: 0,
    heroDerived,
    heroBuffs: [],
    heroLevel: hero.level,
    enemies,
    currentEnemyIndex: 0,
    selectedTargetUid: null,
    targetingMode: false,
    pendingSkillId: null,
    waveIndex,
    totalWaves: level.waves.length,
    turnCount: 0,
    log: [],
  };
}

// ─── Buff 辅助 ─────────────────────────────────────────

function hasBuff(buffs: TurnBuff[], kind: BuffKind): TurnBuff | undefined {
  return buffs.find(b => b.kind === kind);
}

function pushBuff(buffs: TurnBuff[], kind: BuffKind, value: number, duration: number, sourceSkill?: string): void {
  const existing = buffs.find(b => b.kind === kind);
  if (existing) {
    existing.value = Math.max(existing.value, value);
    existing.remainingTurns = Math.max(existing.remainingTurns, duration);
  } else {
    buffs.push({ kind, value, remainingTurns: duration, sourceSkill });
  }
}

function tickBuffs(buffs: TurnBuff[]): void {
  for (let i = buffs.length - 1; i >= 0; i--) {
    buffs[i].remainingTurns -= 1;
    if (buffs[i].remainingTurns <= 0) {
      buffs.splice(i, 1);
    }
  }
}

// ─── 效果施加 ─────────────────────────────────────────

/** 施加对敌效果（对特定敌人） */
function applyEnemyEffects(enemy: EnemyCombatState, state: TurnState, effects: SkillEffect[]): void {
  for (const e of effects) {
    const resist = enemy.derived.statusResist;
    switch (e.kind) {
      case 'stun':
        if (Math.random() < ((e.chance ?? 1) * (1 - resist))) {
          pushBuff(enemy.buffs, 'stun', 1, e.duration ?? 1);
        }
        break;
      case 'bleed':
        pushBuff(enemy.buffs, 'bleed', e.value ?? 0, e.duration ?? 2);
        break;
      case 'burn':
        pushBuff(enemy.buffs, 'burn', e.value ?? 0, e.duration ?? 2);
        break;
      case 'poison':
        pushBuff(enemy.buffs, 'poison', e.value ?? 0, e.duration ?? 2);
        break;
      case 'curse':
        if (Math.random() < (1 - resist)) {
          pushBuff(enemy.buffs, 'curse', GAME_BALANCE.CURSE_STAT_REDUCTION, e.duration ?? 2);
        }
        break;
      case 'def_down':
        pushBuff(enemy.buffs, 'def_down', e.value ?? 0, e.duration ?? 1);
        break;
      case 'atk_down':
        pushBuff(enemy.buffs, 'atk_down', e.value ?? 0, e.duration ?? 1);
        break;
      case 'freeze':
        if (Math.random() < ((e.chance ?? 1) * (1 - resist))) {
          pushBuff(enemy.buffs, 'freeze', 1, e.duration ?? 1);
        }
        break;
      case 'paralyse':
        if (Math.random() < ((e.chance ?? 1) * (1 - resist))) {
          pushBuff(enemy.buffs, 'paralyse', 1, e.duration ?? 1);
        }
        break;
      case 'slow':
        pushBuff(enemy.buffs, 'slow', GAME_BALANCE.SLOW_SPEED_REDUCTION, e.duration ?? 2);
        break;
      case 'holy':
        if (!enemy.tags.includes('undead')) {
          state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor(state.heroMaxHp * GAME_BALANCE.HOLY_HEAL_RATE));
        }
        break;
    }
  }
}

/** 施加对己效果（英雄） */
function applyHeroSelfEffects(state: TurnState, effects: SkillEffect[]): void {
  for (const e of effects) {
    switch (e.kind) {
      case 'shield':
        state.heroShield += e.value ?? 0;
        pushBuff(state.heroBuffs, 'shield', e.value ?? 0, e.duration ?? 1);
        break;
      case 'heal':
        state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor((e.value ?? 0) * state.heroMaxHp));
        break;
      case 'def_up':
        pushBuff(state.heroBuffs, 'def_up', e.value ?? 0, e.duration ?? 1);
        break;
      case 'atk_up':
        pushBuff(state.heroBuffs, 'atk_up', e.value ?? 0, e.duration ?? 1);
        break;
      case 'rage_gain':
        state.heroRage = Math.min(state.heroMaxRage, state.heroRage + (e.value ?? 0));
        break;
      case 'taunt':
        pushBuff(state.heroBuffs, 'taunt', e.value ?? 0, e.duration ?? 1);
        break;
      case 'indomitable':
        pushBuff(state.heroBuffs, 'indomitable', e.value ?? GAME_BALANCE.INDOMITABLE_REDUCTION, e.duration ?? 1);
        break;
      case 'counter':
        pushBuff(state.heroBuffs, 'counter', e.value ?? 0, e.duration ?? GAME_BALANCE.COUNTER_DURATION_DEFAULT);
        break;
    }
  }
}

/** 施加对己效果（敌人） */
function applyEnemySelfEffects(enemy: EnemyCombatState, effects: SkillEffect[]): void {
  for (const e of effects) {
    switch (e.kind) {
      case 'heal':
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.floor((e.value ?? 0) * enemy.maxHp));
        break;
      case 'shield':
        pushBuff(enemy.buffs, 'shield', e.value ?? 0, e.duration ?? 1);
        break;
      case 'def_up':
        pushBuff(enemy.buffs, 'def_up', e.value ?? 0, e.duration ?? 1);
        break;
      case 'atk_up':
        pushBuff(enemy.buffs, 'atk_up', e.value ?? 0, e.duration ?? 1);
        break;
    }
  }
}

/** 施加对英雄减益效果（敌人攻击英雄时） */
function applyHeroDebuffs(state: TurnState, effects: SkillEffect[]): void {
  for (const e of effects) {
    const resist = state.heroDerived.statusResist;
    switch (e.kind) {
      case 'stun':
        if (Math.random() < ((e.chance ?? 1) * (1 - resist))) {
          pushBuff(state.heroBuffs, 'stun', 1, e.duration ?? 1);
        }
        break;
      case 'bleed':
        pushBuff(state.heroBuffs, 'bleed', e.value ?? 0, e.duration ?? 2);
        break;
      case 'burn':
        pushBuff(state.heroBuffs, 'burn', e.value ?? 0, e.duration ?? 2);
        break;
      case 'poison':
        pushBuff(state.heroBuffs, 'poison', e.value ?? 0, e.duration ?? 2);
        break;
      case 'curse':
        if (Math.random() < (1 - resist)) {
          pushBuff(state.heroBuffs, 'curse', GAME_BALANCE.CURSE_STAT_REDUCTION, e.duration ?? 2);
        }
        break;
      case 'def_down':
        pushBuff(state.heroBuffs, 'def_down', e.value ?? 0, e.duration ?? 1);
        break;
      case 'atk_down':
        pushBuff(state.heroBuffs, 'atk_down', e.value ?? 0, e.duration ?? 1);
        break;
      case 'freeze':
        if (Math.random() < ((e.chance ?? 1) * (1 - resist))) {
          pushBuff(state.heroBuffs, 'freeze', 1, e.duration ?? 1);
        }
        break;
      case 'paralyse':
        if (Math.random() < ((e.chance ?? 1) * (1 - resist))) {
          pushBuff(state.heroBuffs, 'paralyse', 1, e.duration ?? 1);
        }
        break;
      case 'slow':
        pushBuff(state.heroBuffs, 'slow', GAME_BALANCE.SLOW_SPEED_REDUCTION, e.duration ?? 2);
        break;
    }
  }
}

// ─── 回合开始处理 ─────────────────────────────────────

function processHeroStartOfTurn(state: TurnState): { skipped: boolean; logs: TurnLogEntry[] } {
  const logs: TurnLogEntry[] = [];
  const buffs = state.heroBuffs;

  for (const b of buffs) {
    if (b.kind === 'bleed' || b.kind === 'burn' || b.kind === 'poison') {
      const dmg = b.value;
      state.heroHp -= dmg;
      const nameMap: Record<string, string> = { bleed: '流血', burn: '燃烧', poison: '毒素' };
      logs.push({ turn: state.turnCount, actor: 'hero', action: 'dot', damage: dmg, skillName: nameMap[b.kind], damageType: b.kind });
    }
  }

  const derived = state.heroDerived;
  if (derived.hpRegen > 0) {
    state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor(derived.hpRegen));
  }
  if (derived.resourceRegen > 0) {
    state.heroRage = Math.min(state.heroMaxRage, state.heroRage + Math.floor(derived.resourceRegen));
  }

  const indom = hasBuff(buffs, 'indomitable');
  if (indom && state.heroHp / state.heroMaxHp < 0.4) {
    state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor(state.heroMaxHp * GAME_BALANCE.INDOMITABLE_HEAL_RATE));
  }

  const stunned = hasBuff(buffs, 'stun');
  const paralysed = hasBuff(buffs, 'paralyse');
  const frozen = hasBuff(buffs, 'freeze');
  const skipped = !!(stunned || paralysed || frozen);
  if (skipped) {
    const name = stunned ? '被击晕' : paralysed ? '被麻痹' : '被冰冻';
    logs.push({ turn: state.turnCount, actor: 'hero', action: 'defend', skillName: name });
  }
  return { skipped, logs };
}

function processEnemyStartOfTurn(state: TurnState, enemy: EnemyCombatState): { skipped: boolean; logs: TurnLogEntry[] } {
  const logs: TurnLogEntry[] = [];
  const buffs = enemy.buffs;

  for (const b of buffs) {
    if (b.kind === 'bleed' || b.kind === 'burn' || b.kind === 'poison') {
      const dmg = b.value;
      enemy.hp -= dmg;
      const nameMap: Record<string, string> = { bleed: '流血', burn: '燃烧', poison: '毒素' };
      logs.push({ turn: state.turnCount, actor: 'enemy', action: 'dot', damage: dmg, skillName: nameMap[b.kind], damageType: b.kind, targetUid: enemy.uid });
    }
  }

  const stunned = hasBuff(buffs, 'stun');
  const paralysed = hasBuff(buffs, 'paralyse');
  const frozen = hasBuff(buffs, 'freeze');
  const skipped = !!(stunned || paralysed || frozen);
  if (skipped) {
    const name = stunned ? '被击晕' : paralysed ? '被麻痹' : '被冰冻';
    logs.push({ turn: state.turnCount, actor: 'enemy', action: 'defend', skillName: name, targetUid: enemy.uid });
  }

  if (enemy.hp <= 0) {
    enemy.alive = false;
  }

  return { skipped, logs };
}

// ─── 伤害结算辅助 ──────────────────────────────────────

function deriveElement(effects: SkillEffect[] | undefined): ElementKind | undefined {
  if (!effects) return undefined;
  if (effects.some(e => e.kind === 'burn')) return 'fire';
  if (effects.some(e => e.kind === 'freeze' || e.kind === 'slow')) return 'ice';
  if (effects.some(e => e.kind === 'paralyse')) return 'lightning';
  if (effects.some(e => e.kind === 'poison')) return 'poison';
  if (effects.some(e => e.kind === 'curse')) return 'shadow';
  if (effects.some(e => e.kind === 'holy')) return 'holy';
  return undefined;
}

/** 对单个敌人造成伤害 */
function dealDamageToEnemy(
  state: TurnState,
  enemy: EnemyCombatState,
  heroEff: DerivedStats,
  skill: Skill,
): { damage: number; isHit: boolean; isCrit: boolean } {
  const enemyEff = getEffectiveDerived(enemy.derived, enemy.buffs);
  const amount = heroEff.physicalAttack * skill.damageMultiplier * (skill.multiTargetDamageRate ?? 1.0);
  const instance: DamageInstance = { category: 'physical', amount };
  const result = calcDamage(heroEff, enemyEff, instance, enemy.tags, state.heroLevel, enemy.level);
  if (!result.isHit) {
    return { damage: 0, isHit: false, isCrit: false };
  }
  enemy.hp -= result.amount;
  // 吸血
  const leech = heroEff.physicalLeech;
  if (leech > 0 && result.amount > 0) {
    state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor(result.amount * leech));
  }
  // 反弹
  const reflect = enemyEff.damageReflect;
  if (reflect > 0 && result.amount > 0) {
    state.heroHp -= Math.floor(result.amount * reflect);
  }
  if (enemy.hp <= 0) {
    enemy.alive = false;
  }
  return { damage: result.amount, isHit: true, isCrit: result.isCrit };
}

/** 连锁目标选择 */
function selectChainTargets(
  candidates: EnemyCombatState[],
  count: number,
  strategy: string,
): EnemyCombatState[] {
  if (candidates.length <= count) return [...candidates];
  switch (strategy) {
    case 'lowest_hp':
      return [...candidates].sort((a, b) => a.hp - b.hp).slice(0, count);
    case 'nearest':
      return candidates.slice(0, count);
    case 'random':
    default: {
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    }
  }
}

// ─── 玩家行动 ─────────────────────────────────────────

function resolvePlayerAction(
  state: TurnState,
  hero: Hero,
  action: TurnAction,
): TurnLogEntry | null {
  const heroEff = getEffectiveDerived(state.heroDerived, state.heroBuffs);

  switch (action.kind) {
    case 'attack': {
      const target = state.enemies.find(e => e.uid === action.targetUid && e.alive);
      if (!target) return null;
      const enemyEff = getEffectiveDerived(target.derived, target.buffs);
      const instance: DamageInstance = { category: 'physical', style: 'melee', amount: heroEff.physicalAttack };
      const result = calcDamage(heroEff, enemyEff, instance, target.tags, state.heroLevel, target.level);
      if (!result.isHit) {
        state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_ATTACK);
        return { turn: state.turnCount, actor: 'hero', action: 'attack', damage: 0, damageType: 'physical', skillName: '未命中', rageGain: GAME_BALANCE.RAGE_PER_ATTACK, targetUid: target.uid };
      }
      target.hp -= result.amount;
      if (target.hp <= 0) target.alive = false;
      state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_ATTACK);
      const leech = heroEff.physicalLeech;
      if (leech > 0) state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor(result.amount * leech));
      const reflect = enemyEff.damageReflect;
      if (reflect > 0) state.heroHp -= Math.floor(result.amount * reflect);
      return { turn: state.turnCount, actor: 'hero', action: 'attack', damage: result.amount, damageType: 'physical', crit: result.isCrit, rageGain: GAME_BALANCE.RAGE_PER_ATTACK, targetUid: target.uid };
    }

    case 'skill': {
      const base = hero.skills.find(s => s.id === action.skillId);
      if (!base) return null;
      const skill = getEffectiveSkill(base, hero.learnedTalents);
      if (skill.rageCost > state.heroRage) return null;
      state.heroRage -= skill.rageCost;
      return resolveSkill(state, hero, heroEff, skill, action);
    }

    case 'defend': {
      state.heroDefending = true;
      state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_BLOCK);
      return { turn: state.turnCount, actor: 'hero', action: 'defend', rageGain: GAME_BALANCE.RAGE_PER_BLOCK };
    }

    case 'flee': {
      const aliveEnemies = state.enemies.filter(e => e.alive);
      const fastestEnemySpeed = aliveEnemies.length > 0
        ? Math.max(...aliveEnemies.map(e => e.derived.speed))
        : 0;
      const speedDiff = heroEff.speed - fastestEnemySpeed;
      const chance = GAME_BALANCE.FLEE_BASE_CHANCE + speedDiff * GAME_BALANCE.FLEE_SPEED_FACTOR;
      if (Math.random() < Math.min(0.95, chance)) {
        state.phase = 'flee';
      }
      return { turn: state.turnCount, actor: 'hero', action: 'flee' };
    }

    default:
      return null;
  }
}

function resolveSkill(
  state: TurnState,
  hero: Hero,
  heroEff: DerivedStats,
  skill: Skill,
  action: TurnAction,
): TurnLogEntry | null {
  const targeting = skill.targeting ?? 'single';
  const element = deriveElement(skill.effects);

  // self 技能或无伤害技能：只施加自身效果
  if (targeting === 'self' || skill.damageMultiplier === 0) {
    applyHeroSelfEffects(state, skill.selfEffects || []);
    return {
      turn: state.turnCount, actor: 'hero', action: 'skill',
      skillName: skill.name, skillId: skill.id, damage: 0,
      damageType: element || 'physical', rageGain: -skill.rageCost,
    };
  }

  let totalDmg = 0;
  let isCrit = false;
  let isHit = false;
  let primaryTargetUid: string | undefined = action.targetUid;

  if (targeting === 'single') {
    const target = state.enemies.find(e => e.uid === action.targetUid && e.alive);
    if (!target) return null;
    const result = dealDamageToEnemy(state, target, heroEff, skill);
    isHit = result.isHit;
    if (isHit) { totalDmg = result.damage; isCrit = result.isCrit; }
    primaryTargetUid = target.uid;
    if (isHit) applyEnemyEffects(target, state, skill.effects || []);

  } else if (targeting === 'chain') {
    const primary = state.enemies.find(e => e.uid === action.targetUid && e.alive);
    if (!primary) return null;
    const targetCount = skill.targetCount ?? 2;
    const decay = skill.chainDecay ?? 0.7;

    const result = dealDamageToEnemy(state, primary, heroEff, skill);
    isHit = result.isHit;
    if (isHit) { totalDmg = result.damage; isCrit = result.isCrit; applyEnemyEffects(primary, state, skill.effects || []); }
    primaryTargetUid = primary.uid;

    const candidates = state.enemies.filter(e => e.alive && e.uid !== primary.uid);
    const secondary = selectChainTargets(candidates, targetCount - 1, skill.chainSelection ?? 'random');
    for (let i = 0; i < secondary.length; i++) {
      const decayMult = Math.pow(decay, i + 1);
      const secSkill = { ...skill, damageMultiplier: skill.damageMultiplier * decayMult };
      const secResult = dealDamageToEnemy(state, secondary[i], heroEff, secSkill);
      if (secResult.isHit) {
        totalDmg += secResult.damage;
        applyEnemyEffects(secondary[i], state, skill.effects || []);
      }
    }

  } else if (targeting === 'auto_all') {
    for (const enemy of state.enemies.filter(e => e.alive)) {
      const result = dealDamageToEnemy(state, enemy, heroEff, skill);
      if (result.isHit) {
        totalDmg += result.damage;
        isHit = true;
        applyEnemyEffects(enemy, state, skill.effects || []);
      }
    }

  } else if (targeting === 'multi') {
    const targetUids = action.targetUids ?? [];
    for (const uid of targetUids) {
      const target = state.enemies.find(e => e.uid === uid && e.alive);
      if (!target) continue;
      const result = dealDamageToEnemy(state, target, heroEff, skill);
      if (result.isHit) {
        totalDmg += result.damage;
        isHit = true;
        applyEnemyEffects(target, state, skill.effects || []);
      }
    }
  }

  applyHeroSelfEffects(state, skill.selfEffects || []);

  if (!isHit && totalDmg === 0) {
    return { turn: state.turnCount, actor: 'hero', action: 'skill', skillName: skill.name, skillId: skill.id, damage: 0, damageType: element || 'physical', rageGain: -skill.rageCost };
  }

  return {
    turn: state.turnCount, actor: 'hero', action: 'skill',
    skillName: skill.name, skillId: skill.id, damage: totalDmg,
    damageType: element || 'physical', crit: isCrit, rageGain: -skill.rageCost,
    targetUid: primaryTargetUid,
  };
}

// ─── 敌方行动 ─────────────────────────────────────────

function resolveEnemyAction(
  state: TurnState,
  enemy: EnemyCombatState,
  enemyIndex: number,
): TurnLogEntry | null {
  const skill = selectMonsterSkill(enemy, state);
  const enemyEff = getEffectiveDerived(enemy.derived, enemy.buffs);
  const heroEff = getEffectiveDerived(state.heroDerived, state.heroBuffs);

  if (skill.damageMultiplier > 0) {
    const amount = enemyEff.physicalAttack * skill.damageMultiplier;
    const instance: DamageInstance = { category: 'physical', amount };
    const result = calcDamage(enemyEff, heroEff, instance, undefined, enemy.level, state.heroLevel);

    if (!result.isHit) {
      return { turn: state.turnCount, actor: 'enemy', action: 'attack', damage: 0, damageType: 'physical', skillName: '未命中', enemyIndex, targetUid: enemy.uid };
    }

    let finalDmg = result.amount;
    if (state.heroShield > 0) {
      const absorbed = Math.min(state.heroShield, finalDmg);
      state.heroShield -= absorbed;
      finalDmg -= absorbed;
    }
    if (state.heroDefending) {
      finalDmg = Math.floor(finalDmg * (1 - GAME_BALANCE.BLOCK_DAMAGE_REDUCTION));
    }
    const indom = hasBuff(state.heroBuffs, 'indomitable');
    if (indom) {
      finalDmg = Math.floor(finalDmg * (1 - indom.value));
    }
    finalDmg = Math.max(1, finalDmg);
    state.heroHp -= finalDmg;
    state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_HIT);

    const counter = hasBuff(state.heroBuffs, 'counter');
    if (counter) {
      const counterDmg = Math.floor(finalDmg * counter.value);
      enemy.hp -= counterDmg;
      if (enemy.hp <= 0) enemy.alive = false;
    }

    const leech = enemyEff.physicalLeech;
    if (leech > 0) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.floor(finalDmg * leech));
    }

    applyHeroDebuffs(state, skill.effects || []);
    applyEnemySelfEffects(enemy, skill.selfEffects || []);

    return {
      turn: state.turnCount, actor: 'enemy', action: 'skill',
      skillName: skill.name, skillId: skill.id, damage: finalDmg,
      damageType: deriveElement(skill.effects) || 'physical',
      rageGain: GAME_BALANCE.RAGE_PER_HIT, enemyIndex, targetUid: enemy.uid,
    };
  } else {
    applyEnemySelfEffects(enemy, skill.selfEffects || []);
    applyHeroDebuffs(state, skill.effects || []);
    return {
      turn: state.turnCount, actor: 'enemy', action: 'skill',
      skillName: skill.name, skillId: skill.id, damage: 0,
      enemyIndex, targetUid: enemy.uid,
    };
  }
}

// ─── 波次检查 ─────────────────────────────────────────

function checkAllEnemiesDefeated(state: TurnState): boolean {
  return state.enemies.every(e => !e.alive);
}

// ─── 回合结算 ─────────────────────────────────────────

export function runTurn(state: TurnState, hero: Hero, action: TurnAction): TurnState {
  if (state.phase !== 'player') return state;
  const next: TurnState = {
    ...state,
    log: [...state.log],
    heroBuffs: [...state.heroBuffs],
    enemies: state.enemies.map(e => ({ ...e, buffs: [...e.buffs] })),
  };

  const start = processHeroStartOfTurn(next);
  start.logs.forEach(l => next.log.push(l));

  if (start.skipped) {
    next.phase = 'enemy';
    return next;
  }

  const playerLog = resolvePlayerAction(next, hero, action);
  if (playerLog) next.log.push(playerLog);

  if (next.phase === 'flee') return next;

  if (checkAllEnemiesDefeated(next)) {
    next.log.push({ turn: next.turnCount, actor: 'enemy', action: 'attack', defeated: true });
    if (next.waveIndex + 1 >= next.totalWaves) {
      next.phase = 'win';
    } else {
      next.waveIndex += 1;
      next.phase = 'anim';
    }
    return next;
  }

  next.phase = 'enemy';
  return next;
}

export function runEnemyTurn(state: TurnState, hero: Hero): TurnState {
  if (state.phase !== 'enemy') return state;
  const next: TurnState = {
    ...state,
    log: [...state.log],
    heroBuffs: [...state.heroBuffs],
    enemies: state.enemies.map(e => ({ ...e, buffs: [...e.buffs] })),
  };

  for (let i = 0; i < next.enemies.length; i++) {
    const enemy = next.enemies[i];
    if (!enemy.alive) continue;

    const start = processEnemyStartOfTurn(next, enemy);
    start.logs.forEach(l => next.log.push(l));

    if (!enemy.alive) continue;
    if (start.skipped) continue;

    const enemyLog = resolveEnemyAction(next, enemy, i);
    if (enemyLog) next.log.push(enemyLog);

    if (next.heroHp <= 0) {
      next.phase = 'lose';
      next.log.push({ turn: next.turnCount, actor: 'hero', action: 'attack', defeated: true });
      return next;
    }
  }

  next.turnCount += 1;
  next.heroDefending = false;
  tickBuffs(next.heroBuffs);
  for (const enemy of next.enemies) {
    tickBuffs(enemy.buffs);
  }
  next.phase = 'player';
  return next;
}

// ─── 波次推进（客户端调用） ─────────────────────────────

export function advanceToNextWave(state: TurnState, hero: Hero, level: LevelDef): TurnState {
  const nextWaveIndex = state.waveIndex;
  const newTs = initTurnState(hero, level, nextWaveIndex);
  newTs.heroHp = Math.min(newTs.heroMaxHp, state.heroHp);
  newTs.heroRage = Math.min(newTs.heroMaxRage, state.heroRage);
  newTs.heroBuffs = state.heroBuffs;
  newTs.log = state.log;
  newTs.turnCount = state.turnCount;
  return newTs;
}

// ─── 战斗奖励 ─────────────────────────────────────────

export interface BattleRewardResult {
  resources: Partial<Resources>;
  equipment: ReturnType<typeof generateEquipment>[];
  isFirstClear: boolean;
}

export function calcBattleReward(
  hero: Hero,
  level: LevelDef,
  levelProgressCleared: boolean,
): BattleRewardResult {
  const totalWaves = level.waves.length;
  const regionNum = level.regionId === 'region_1' ? 1 : level.regionId === 'region_2' ? 2 : 3;
  const gold = GAME_BALANCE.BASE_GOLD_PER_KILL * totalWaves * regionNum;
  const exp = GAME_BALANCE.BASE_EXP_PER_KILL * totalWaves * regionNum;

  const isFirstClear = !levelProgressCleared;
  const firstClear = isFirstClear ? level.firstClearReward : {};

  const dropRateBonus = hero.stats.luck * GAME_BALANCE.STAT_SCALARS.LUCK_TO_RARITY_BONUS;

  const equipment: BattleRewardResult['equipment'] = [];
  const count = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < count; i++) {
    equipment.push(generateEquipment(hero.level, hero.class, { dropRateBonus }));
  }

  return {
    resources: { gold, exp, ...firstClear },
    equipment,
    isFirstClear,
  };
}

// ─── 天赋管理 ─────────────────────────────────────────

export function resetTalents(hero: Hero): Hero {
  const starterIds = new Set(['skill_heavy_strike']);
  return {
    ...hero,
    learnedTalents: {},
    spentPoints: 0,
    talentPoints: hero.talentPoints + hero.spentPoints,
    skills: hero.skills.filter(s => starterIds.has(s.id)),
  };
}

export function learnTalent(hero: Hero, nodeId: string): Hero {
  const node = TALENT_NODE_MAP[nodeId];
  if (!node || hero.talentPoints <= 0) return hero;

  for (const req of node.requires || []) {
    if (!(hero.learnedTalents[req] > 0)) return hero;
  }

  if (node.exclusiveGroup) {
    const groupLearned = WARRIOR_TALENT_TREE.nodes.some(
      (n) =>
        n.id !== node.id &&
        n.exclusiveGroup === node.exclusiveGroup &&
        (hero.learnedTalents[n.id] || 0) > 0,
    );
    if (groupLearned) return hero;
  }

  const tier = WARRIOR_TALENT_TREE.tiers.find(t => t.tier === node.tier);
  if (tier && totalSpent(hero.learnedTalents) < tier.unlockAt && node.kind !== 'label') {
    return hero;
  }

  const currentRank = hero.learnedTalents[nodeId] || 0;
  if (currentRank >= node.maxRank) return hero;

  const newLearned = { ...hero.learnedTalents, [nodeId]: currentRank + 1 };
  let newSkills = hero.skills;

  if (node.kind === 'skill' && node.skillId && currentRank === 0) {
    const skill = SKILL_MAP[node.skillId];
    if (skill && !hero.skills.some(s => s.id === skill.id)) {
      newSkills = [...hero.skills, skill];
    }
  }

  return {
    ...hero,
    skills: newSkills,
    talentPoints: hero.talentPoints - 1,
    spentPoints: hero.spentPoints + 1,
    learnedTalents: newLearned,
  };
}

export function canRefundTalent(learned: LearnedTalents, nodeId: string): boolean {
  const currentRank = learned[nodeId] || 0;
  if (currentRank <= 0) return false;

  const newLearned = { ...learned };
  if (currentRank === 1) {
    delete newLearned[nodeId];
  } else {
    newLearned[nodeId] = currentRank - 1;
  }

  for (const n of WARRIOR_TALENT_TREE.nodes) {
    if ((newLearned[n.id] || 0) > 0) {
      for (const req of n.requires || []) {
        if (!(newLearned[req] > 0)) return false;
      }
    }
  }

  for (const n of WARRIOR_TALENT_TREE.nodes) {
    if ((newLearned[n.id] || 0) > 0 && n.tier > 1) {
      const tierDef = WARRIOR_TALENT_TREE.tiers.find(t => t.tier === n.tier);
      if (tierDef) {
        const spentBelow = WARRIOR_TALENT_TREE.nodes
          .filter(other => other.tier < n.tier)
          .reduce((sum, other) => sum + (newLearned[other.id] || 0), 0);
        if (spentBelow < tierDef.unlockAt) return false;
      }
    }
  }

  return true;
}

export function refundTalent(hero: Hero, nodeId: string): Hero {
  if (!canRefundTalent(hero.learnedTalents, nodeId)) return hero;
  const node = TALENT_NODE_MAP[nodeId];
  if (!node) return hero;

  const currentRank = hero.learnedTalents[nodeId] || 0;
  const newLearned = { ...hero.learnedTalents };
  if (currentRank === 1) {
    delete newLearned[nodeId];
  } else {
    newLearned[nodeId] = currentRank - 1;
  }

  let newSkills = hero.skills;
  if (node.kind === 'skill' && node.skillId && currentRank === 1) {
    newSkills = hero.skills.filter(s => s.id !== node.skillId);
  }

  return {
    ...hero,
    skills: newSkills,
    talentPoints: hero.talentPoints + 1,
    spentPoints: hero.spentPoints - 1,
    learnedTalents: newLearned,
  };
}

// ─── 便捷导出 ─────────────────────────────────────────

export { LEVELS };
