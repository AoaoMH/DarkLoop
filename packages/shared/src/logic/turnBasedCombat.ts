/**
 * 回合制战斗纯逻辑 - 状态机驱动（支持完整技能机制 + 属性系统）
 * 状态推进：runTurn(state, action) → newState（纯函数，无副作用）
 *
 * 支持机制：
 *   控制：眩晕/麻痹/冰冻/减速
 *   DOT：流血/燃烧/毒素（可叠加）
 *   防御：护盾/格挡/减伤/不屈/嘲讽
 *   进攻：破甲/穿透/连锁多目标/蓄力/反伤/吸血/反弹
 *   元素：火焰/冰霜/闪电/毒素/暗影/神圣
 *   辅助：怒气回复/生命回复/资源回复
 */

import type {
  Hero, Skill, SkillEffect, SkillEffectKind,
  TurnState, TurnAction, TurnLogEntry, TurnBuff, BuffKind,
  LevelDef, MonsterDef, Resources, LearnedTalents, TalentNode,
  DerivedStats, DamageInstance, ElementKind, AffixTag,
} from '../types';
import { GAME_BALANCE } from '../constants/balance';
import { WARRIOR_TALENT_TREE, TALENT_NODE_MAP } from '../constants/talents';
import { SKILL_MAP } from '../constants/skills';
import { LEVELS } from '../constants/levels';
import { calcDamage, calcHeroDerived, calcDerivedStats } from './combat';
import { generateEquipment } from './loot';

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

/** 返回受 buff 影响的 DerivedStats 副本（用于伤害计算） */
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
  const monster: MonsterDef = wave.monsters[0];

  const heroDerived = calcHeroDerived(hero);
  const enemyDerived = calcDerivedStats(monster.baseStats, [], monster.level);
  const maxHp = heroDerived.maxHp;
  const maxRage = heroDerived.maxResource;

  const heroSpeed = heroDerived.speed;
  const enemySpeed = enemyDerived.speed;
  const speedDiff = heroSpeed - enemySpeed;
  const firstStrikeBase = speedDiff > 0 ? 0.6 : speedDiff === 0 ? 0.5 : 0.4;
  const heroFirst = Math.random() < Math.min(0.95, firstStrikeBase);

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
    enemyHp: enemyDerived.maxHp,
    enemyMaxHp: enemyDerived.maxHp,
    enemyDef: enemyDerived.armor,
    enemyAtk: enemyDerived.physicalAttack,
    enemySpeed: enemyDerived.speed,
    enemyIsBoss: !!monster.isBoss,
    enemyName: monster.name,
    enemyIcon: monster.icon,
    enemyTags: monster.tags || [],
    enemyDerived,
    waveIndex,
    totalWaves: level.waves.length,
    turnCount: 0,
    log: [],
    heroBuffs: [],
    enemyBuffs: [],
  };
}

// ─── Buff 辅助 ─────────────────────────────────────────

function hasBuff(buffs: TurnBuff[], kind: BuffKind): TurnBuff | undefined {
  return buffs.find(b => b.kind === kind);
}

function pushBuff(buffs: TurnBuff[], kind: BuffKind, value: number, remainingTurns: number, sourceSkill?: string): void {
  const existing = buffs.find(b => b.kind === kind);
  if (existing) {
    // poison 可叠加（值相加），其他取 max
    if (kind === 'poison') {
      existing.value = Math.min(existing.value + value, GAME_BALANCE.POISON_STACK_MAX * value);
    } else {
      existing.value = Math.max(existing.value, value);
    }
    existing.remainingTurns = Math.max(existing.remainingTurns, remainingTurns);
  } else {
    buffs.push({ kind, value, remainingTurns, sourceSkill });
  }
}

function tickBuffs(buffs: TurnBuff[]): void {
  for (let i = buffs.length - 1; i >= 0; i--) {
    buffs[i].remainingTurns -= 1;
    if (buffs[i].remainingTurns <= 0) buffs.splice(i, 1);
  }
}

// ─── 效果施加 ─────────────────────────────────────────

/** 施加对敌效果 */
function applyEnemyEffects(state: TurnState, effects: SkillEffect[]): void {
  for (const e of effects) {
    // 异常抗性概率抵抗
    const resist = state.enemyDerived.statusResist;
    switch (e.kind) {
      case 'stun':
        if (e.chance && Math.random() < e.chance * (1 - resist)) {
          pushBuff(state.enemyBuffs, 'stun', 1, e.duration ?? 1);
        }
        break;
      case 'paralyse':
        if (e.chance && Math.random() < e.chance * (1 - resist)) {
          pushBuff(state.enemyBuffs, 'paralyse', 1, e.duration ?? 1);
        }
        break;
      case 'freeze':
        if (e.chance && Math.random() < e.chance * (1 - resist)) {
          pushBuff(state.enemyBuffs, 'freeze', 1, e.duration ?? 1);
        }
        break;
      case 'slow':
        if (e.chance && Math.random() < e.chance * (1 - resist)) {
          pushBuff(state.enemyBuffs, 'slow', GAME_BALANCE.SLOW_SPEED_REDUCTION, e.duration ?? 2);
        }
        break;
      case 'bleed':
        pushBuff(state.enemyBuffs, 'bleed', e.value ?? 0, e.duration ?? 1);
        break;
      case 'burn':
        pushBuff(state.enemyBuffs, 'burn', e.value ?? 0, e.duration ?? 1);
        break;
      case 'poison':
        pushBuff(state.enemyBuffs, 'poison', e.value ?? 0, e.duration ?? 2);
        break;
      case 'curse':
        if (Math.random() < (1 - resist)) {
          pushBuff(state.enemyBuffs, 'curse', GAME_BALANCE.CURSE_STAT_REDUCTION, e.duration ?? 2);
        }
        break;
      case 'def_down':
        pushBuff(state.enemyBuffs, 'def_down', e.value ?? 0, e.duration ?? 1);
        break;
      case 'atk_down':
        pushBuff(state.enemyBuffs, 'atk_down', e.value ?? 0, e.duration ?? 1);
        break;
      // holy 对亡灵伤害在 calcDamage 处理；对非亡灵治疗在 applySelfEffects
      case 'holy':
        if (!state.enemyTags.includes('undead')) {
          state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor(state.heroMaxHp * GAME_BALANCE.HOLY_HEAL_RATE));
        }
        break;
      // multi_target / pierce / chain 在伤害计算时处理
    }
  }
}

/** 施加对己效果 */
function applySelfEffects(state: TurnState, effects: SkillEffect[]): void {
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

// ─── 回合开始处理（DOT/回复/不屈/控制） ─────────────────

function processStartOfTurn(state: TurnState, isHero: boolean): { skipped: boolean; logs: TurnLogEntry[] } {
  const logs: TurnLogEntry[] = [];
  const buffs = isHero ? state.heroBuffs : state.enemyBuffs;
  const target = isHero ? 'hero' : 'enemy';

  // DOT 扣血：bleed / burn / poison
  for (const b of buffs) {
    if (b.kind === 'bleed' || b.kind === 'burn' || b.kind === 'poison') {
      const dmg = b.value;
      if (isHero) {
        state.heroHp -= dmg;
      } else {
        state.enemyHp -= dmg;
      }
      const nameMap: Record<string, string> = { bleed: '流血', burn: '燃烧', poison: '毒素' };
      logs.push({ turn: state.turnCount, actor: target, action: 'dot', damage: dmg, skillName: nameMap[b.kind], damageType: b.kind });
    }
  }

  // 回复：hpRegen / resourceRegen
  if (isHero) {
    const derived = state.heroDerived;
    if (derived.hpRegen > 0) {
      const heal = Math.floor(derived.hpRegen);
      state.heroHp = Math.min(state.heroMaxHp, state.heroHp + heal);
    }
    if (derived.resourceRegen > 0) {
      state.heroRage = Math.min(state.heroMaxRage, state.heroRage + Math.floor(derived.resourceRegen));
    }
    // 不屈触发
    const indom = state.heroBuffs.find(b => b.kind === 'indomitable');
    if (indom && state.heroHp / state.heroMaxHp < 0.4) {
      state.heroHp = Math.min(state.heroMaxHp, state.heroHp + Math.floor(state.heroMaxHp * GAME_BALANCE.INDOMITABLE_HEAL_RATE));
    }
  }

  // 控制检查：stun / paralyse / freeze
  const stunned = hasBuff(buffs, 'stun');
  const paralysed = hasBuff(buffs, 'paralyse');
  const frozen = hasBuff(buffs, 'freeze');
  const skipped = !!(stunned || paralysed || frozen);
  if (skipped) {
    const name = stunned ? '被击晕' : paralysed ? '被麻痹' : '被冰冻';
    logs.push({ turn: state.turnCount, actor: target, action: 'defend', skillName: name });
  }
  return { skipped, logs };
}

// ─── 伤害结算辅助 ──────────────────────────────────────

/** 从技能 effects 推导元素类型 */
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

/** 吸血结算 */
function applyLeech(state: TurnState, isHeroAttacker: boolean, damage: number, isPhysical: boolean): void {
  const derived = isHeroAttacker ? state.heroDerived : state.enemyDerived;
  const leech = isPhysical ? derived.physicalLeech : derived.magicLeech;
  if (leech > 0 && damage > 0) {
    const heal = Math.floor(damage * leech);
    if (isHeroAttacker) {
      state.heroHp = Math.min(state.heroMaxHp, state.heroHp + heal);
    } else {
      state.enemyHp = Math.min(state.enemyMaxHp, state.enemyHp + heal);
    }
  }
}

/** 反弹结算 */
function applyReflect(state: TurnState, isHeroAttacker: boolean, damage: number): void {
  const defenderDerived = isHeroAttacker ? state.enemyDerived : state.heroDerived;
  const reflect = defenderDerived.damageReflect;
  if (reflect > 0 && damage > 0) {
    const reflectDmg = Math.floor(damage * reflect);
    if (isHeroAttacker) {
      state.heroHp -= reflectDmg;
    } else {
      state.enemyHp -= reflectDmg;
    }
  }
}

// ─── 回合结算 ─────────────────────────────────────────

export function runTurn(state: TurnState, hero: Hero, action: TurnAction): TurnState {
  if (state.phase !== 'player') return state;
  const next: TurnState = { ...state, log: [...state.log], heroBuffs: [...state.heroBuffs], enemyBuffs: [...state.enemyBuffs] };

  const start = processStartOfTurn(next, true);
  start.logs.forEach(l => next.log.push(l));

  if (start.skipped) {
    next.phase = 'enemy';
    return next;
  }

  const playerLog = resolvePlayerAction(next, hero, action);
  if (playerLog) next.log.push(playerLog);

  if (next.phase === 'flee') return next;

  if (next.enemyHp <= 0) {
    next.log.push({ turn: next.turnCount, actor: 'enemy', action: action.kind, defeated: true });
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
  const next: TurnState = { ...state, log: [...state.log], heroBuffs: [...state.heroBuffs], enemyBuffs: [...state.enemyBuffs] };

  const start = processStartOfTurn(next, false);
  start.logs.forEach(l => next.log.push(l));

  if (start.skipped) {
    next.turnCount += 1;
    next.heroDefending = false;
    tickBuffs(next.heroBuffs);
    tickBuffs(next.enemyBuffs);
    next.phase = 'player';
    return next;
  }

  if (next.enemyHp <= 0) {
    next.log.push({ turn: next.turnCount, actor: 'enemy', action: 'attack', defeated: true });
    if (next.waveIndex + 1 >= next.totalWaves) {
      next.phase = 'win';
    } else {
      next.waveIndex += 1;
      next.phase = 'anim';
    }
    return next;
  }

  const enemyLog = resolveEnemyAction(next);
  if (enemyLog) next.log.push(enemyLog);

  if (next.heroHp <= 0) {
    next.phase = 'lose';
    next.log.push({ turn: next.turnCount, actor: 'hero', action: 'attack', defeated: true });
    return next;
  }

  next.turnCount += 1;
  next.heroDefending = false;
  tickBuffs(next.heroBuffs);
  tickBuffs(next.enemyBuffs);
  next.phase = 'player';
  return next;
}

// ─── 玩家行动 ─────────────────────────────────────────

function resolvePlayerAction(state: TurnState, hero: Hero, action: TurnAction): TurnLogEntry | null {
  const heroEff = getEffectiveDerived(state.heroDerived, state.heroBuffs);
  const enemyEff = getEffectiveDerived(state.enemyDerived, state.enemyBuffs);

  switch (action.kind) {
    case 'attack': {
      const instance: DamageInstance = {
        category: 'physical',
        style: 'melee',
        amount: heroEff.physicalAttack,
      };
      const result = calcDamage(heroEff, enemyEff, instance, state.enemyTags);
      if (!result.isHit) {
        state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_ATTACK);
        return { turn: state.turnCount, actor: 'hero', action: 'attack', damage: 0, damageType: 'physical', skillName: '未命中', rageGain: GAME_BALANCE.RAGE_PER_ATTACK };
      }
      state.enemyHp -= result.amount;
      state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_ATTACK);
      applyLeech(state, true, result.amount, true);
      applyReflect(state, true, result.amount);
      return { turn: state.turnCount, actor: 'hero', action: 'attack', damage: result.amount, damageType: 'physical', crit: result.isCrit, rageGain: GAME_BALANCE.RAGE_PER_ATTACK };
    }
    case 'skill': {
      const base = hero.skills.find(s => s.id === action.skillId);
      if (!base) return null;
      const skill = getEffectiveSkill(base, hero.learnedTalents);
      if (skill.rageCost > state.heroRage) return null;
      state.heroRage -= skill.rageCost;
      return resolveSkill(state, hero, heroEff, enemyEff, skill);
    }
    case 'defend': {
      state.heroDefending = true;
      state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_BLOCK);
      return { turn: state.turnCount, actor: 'hero', action: 'defend', rageGain: GAME_BALANCE.RAGE_PER_BLOCK };
    }
    case 'flee': {
      const speedDiff = heroEff.speed - enemyEff.speed;
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

function resolveSkill(state: TurnState, hero: Hero, heroEff: DerivedStats, enemyEff: DerivedStats, skill: Skill): TurnLogEntry | null {
  // 蓄力技能
  if (skill.chargeSkill) {
    const charging = hasBuff(state.heroBuffs, 'charging');
    if (!charging) {
      state.heroBuffs.push({ kind: 'charging', value: 1, remainingTurns: 2 });
      state.heroDefending = true;
      if (skill.selfEffects) applySelfEffects(state, skill.selfEffects);
      return { turn: state.turnCount, actor: 'hero', action: 'skill', skillName: skill.name + '·蓄力', skillId: skill.id, rageGain: -skill.rageCost };
    }
    state.heroBuffs = state.heroBuffs.filter(b => b.kind !== 'charging');
  }

  let totalDmg = 0;
  let isCrit = false;
  let isHit = true;

  if (skill.damageMultiplier > 0) {
    const element = deriveElement(skill.effects);
    // 蓄力释放暴击加成
    const critBonus = skill.chargeSkill ? GAME_BALANCE.CHARGE_CRIT_BONUS : 0;
    const effAttacker = critBonus > 0 ? { ...heroEff, critRate: heroEff.critRate + critBonus } : heroEff;

    const instance: DamageInstance = {
      category: 'physical',
      style: 'melee',
      amount: effAttacker.physicalAttack * skill.damageMultiplier,
      element,
      sourceSkill: skill.id,
    };
    const result = calcDamage(effAttacker, enemyEff, instance, state.enemyTags);
    isCrit = result.isCrit;
    isHit = result.isHit;

    if (result.isHit) {
      totalDmg = result.amount;
      state.enemyHp -= totalDmg;

      // 多目标/连锁
      const multi = (skill.effects || []).find(e => e.kind === 'multi_target');
      if (multi) {
        const extra = Math.floor(totalDmg * GAME_BALANCE.MULTI_TARGET_DAMAGE_RATE) * (multi.extraHits ?? 0);
        state.enemyHp -= extra;
        totalDmg += extra;
      }

      applyLeech(state, true, totalDmg, true);
      applyReflect(state, true, totalDmg);
    }

    // 施加对敌效果
    applyEnemyEffects(state, skill.effects || []);
  }

  // 施加对己效果
  applySelfEffects(state, skill.selfEffects || []);

  const element = deriveElement(skill.effects);
  if (!isHit) {
    return { turn: state.turnCount, actor: 'hero', action: 'skill', skillName: skill.name, skillId: skill.id, damage: 0, damageType: element || 'physical', rageGain: -skill.rageCost };
  }

  return {
    turn: state.turnCount,
    actor: 'hero',
    action: 'skill',
    skillName: skill.name,
    skillId: skill.id,
    damage: totalDmg,
    damageType: element || 'physical',
    crit: isCrit,
    rageGain: -skill.rageCost,
  };
}

// ─── 敌方行动 ─────────────────────────────────────────

function resolveEnemyAction(state: TurnState): TurnLogEntry | null {
  const enemyEff = getEffectiveDerived(state.enemyDerived, state.enemyBuffs);
  const heroEff = getEffectiveDerived(state.heroDerived, state.heroBuffs);

  const useSkill = state.enemyIsBoss && Math.random() < GAME_BALANCE.BOSS_SKILL_CHANCE;
  const baseDmg = enemyEff.physicalAttack * (useSkill ? GAME_BALANCE.BOSS_SKILL_MULTIPLIER : 1);

  const instance: DamageInstance = {
    category: 'physical',
    amount: baseDmg,
  };
  const result = calcDamage(enemyEff, heroEff, instance);

  if (!result.isHit) {
    return { turn: state.turnCount, actor: 'enemy', action: 'attack', damage: 0, damageType: 'physical', skillName: '未命中' };
  }

  let finalDmg = result.amount;

  // 护盾吸收
  if (state.heroShield > 0) {
    const absorbed = Math.min(state.heroShield, finalDmg);
    state.heroShield -= absorbed;
    finalDmg -= absorbed;
  }

  // 防御减伤
  if (state.heroDefending) {
    finalDmg = Math.floor(finalDmg * (1 - GAME_BALANCE.BLOCK_DAMAGE_REDUCTION));
  }

  // 不屈减伤
  const indom = hasBuff(state.heroBuffs, 'indomitable');
  if (indom) {
    finalDmg = Math.floor(finalDmg * (1 - indom.value));
  }

  finalDmg = Math.max(1, finalDmg);
  state.heroHp -= finalDmg;
  state.heroRage = Math.min(state.heroMaxRage, state.heroRage + GAME_BALANCE.RAGE_PER_HIT);

  // 反伤
  const counter = hasBuff(state.heroBuffs, 'counter');
  if (counter) {
    const counterDmg = Math.floor(finalDmg * counter.value);
    state.enemyHp -= counterDmg;
  }

  // 敌方吸血
  applyLeech(state, false, finalDmg, true);
  // 英雄反弹
  applyReflect(state, false, finalDmg);

  return {
    turn: state.turnCount,
    actor: 'enemy',
    action: useSkill ? 'skill' : 'attack',
    skillName: useSkill ? 'Boss技能' : undefined,
    damage: finalDmg,
    damageType: useSkill ? 'magic' : 'physical',
    rageGain: GAME_BALANCE.RAGE_PER_HIT,
  };
}

// ─── 战斗结算 ─────────────────────────────────────────

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
  const gold = GAME_BALANCE.BASE_GOLD_PER_KILL * totalWaves * level.difficulty;
  const exp = GAME_BALANCE.BASE_EXP_PER_KILL * totalWaves * level.difficulty;

  const isFirstClear = !levelProgressCleared;
  const firstClear = isFirstClear ? level.firstClearReward : {};

  // 运气影响掉落品质
  const dropRateBonus = hero.stats.luck * GAME_BALANCE.STAT_SCALARS.LUCK_TO_RARITY_BONUS;
  const heroTags: AffixTag[] = ['universal', 'warrior'];

  const equipment: BattleRewardResult['equipment'] = [];
  const count = Math.floor(Math.random() * 3) + 1; // 1~3 items
  for (let i = 0; i < count; i++) {
    equipment.push(generateEquipment(hero.level, dropRateBonus, undefined, heroTags));
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
        if (!(newLearned[req] > 0)) {
          return false;
        }
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
        if (spentBelow < tierDef.unlockAt) {
          return false;
        }
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
