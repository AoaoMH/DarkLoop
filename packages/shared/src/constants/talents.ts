/**
 * 战士天赋树 - 纵向 3 级开花式
 * 顶部「基础技能」标签节点 → 第1级 3 主动技能（各 3 扩展）
 *   ↓ 投 5 点解锁
 * 第2级 核心技能（各 3 扩展）
 *   ↓ 投 10 点解锁
 * 第3级 防御技能（各 3 扩展）
 *
 * 主动技能节点：学习后加入 hero.skills，战斗可用
 * 扩展节点：给关联技能追加/移除效果或调整伤害/怒气
 */

import { HeroClass, type TalentTree, type TalentNode } from '../types';

// ─── 顶部标签节点 ─────────────────────────────────────
const LABEL_NODE: TalentNode = {
  id: 'tal_warrior_label',
  tier: 1,
  kind: 'label',
  name: '基础技能',
  desc: '战士的基础技能，从此处开始投入点数',
  icon: '⚔️',
  maxRank: 0,
};

// ─── 第1级 基础技能（unlockAt=0） ─────────────────────

const T1_SKILLS: TalentNode[] = [
  { id: 'tal_shield_bash', tier: 1, kind: 'skill', name: '盾击', desc: '中伤 + 概率击晕', icon: '🛡️', skillId: 'skill_shield_bash', requires: [], maxRank: 1 },
  { id: 'tal_charge_strike', tier: 1, kind: 'skill', name: '蓄力一击', desc: '蓄力后下回合高伤 + 概率暴击', icon: '⚡', skillId: 'skill_charge_strike', requires: [], maxRank: 1 },
  { id: 'tal_lacerate', tier: 1, kind: 'skill', name: '裂伤斩', desc: '伤害 + 流血持续', icon: '🗡️', skillId: 'skill_lacerate', requires: [], maxRank: 1 },
];

const T1_UPGRADES: TalentNode[] = [
  // 盾击扩展（三选一）
  { id: 'tal_shield_bash_power', tier: 1, kind: 'upgrade', name: '大力盾击', desc: '击晕概率 +25%', icon: '💥', parentSkillId: 'skill_shield_bash', requires: ['tal_shield_bash'], exclusiveGroup: 't1_shield_bash', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'stun', chance: 0.25 } }] },
  { id: 'tal_shield_bash_guard', tier: 1, kind: 'upgrade', name: '攻击守势', desc: '释放后获得 20 点护盾', icon: '🛡️', parentSkillId: 'skill_shield_bash', requires: ['tal_shield_bash'], exclusiveGroup: 't1_shield_bash', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'shield', value: 20 } }] },
  { id: 'tal_shield_bash_chain', tier: 1, kind: 'upgrade', name: '连锁飞盾', desc: '移除击晕，额外攻击 2 目标', icon: '🔗', parentSkillId: 'skill_shield_bash', requires: ['tal_shield_bash'], exclusiveGroup: 't1_shield_bash', maxRank: 1, modifiers: [{ kind: 'remove_effect', effectKind: 'stun' }, { kind: 'add_effect', effect: { kind: 'multi_target', extraHits: 2 } }] },
  // 蓄力一击扩展（三选一）
  { id: 'tal_charge_calm', tier: 1, kind: 'upgrade', name: '沉稳', desc: '蓄力期间减伤 +30%', icon: '🌿', parentSkillId: 'skill_charge_strike', requires: ['tal_charge_strike'], exclusiveGroup: 't1_charge_strike', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'def_up', value: 0.3, duration: 1 } }] },
  { id: 'tal_charge_pierce', tier: 1, kind: 'upgrade', name: '破甲', desc: '蓄力释放附加 20% 护甲穿透', icon: '⚔️', parentSkillId: 'skill_charge_strike', requires: ['tal_charge_strike'], exclusiveGroup: 't1_charge_strike', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'pierce', value: 0.2 } }] },
  { id: 'tal_charge_counter', tier: 1, kind: 'upgrade', name: '硬反', desc: '蓄力期间受击反伤 50%', icon: '🤺', parentSkillId: 'skill_charge_strike', requires: ['tal_charge_strike'], exclusiveGroup: 't1_charge_strike', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'counter', value: 0.5, duration: 1 } }] },
  // 裂伤斩扩展（三选一）
  { id: 'tal_lacerate_bleed_dmg', tier: 1, kind: 'upgrade', name: '撕裂强化', desc: '流血伤害 +4/回合', icon: '🩸', parentSkillId: 'skill_lacerate', requires: ['tal_lacerate'], exclusiveGroup: 't1_lacerate', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'bleed', value: 4 } }] },
  { id: 'tal_lacerate_bleed_dur', tier: 1, kind: 'upgrade', name: '放血', desc: '流血持续延长至 5 回合', icon: '💉', parentSkillId: 'skill_lacerate', requires: ['tal_lacerate'], exclusiveGroup: 't1_lacerate', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'bleed', duration: 5 } }] },
  { id: 'tal_lacerate_frenzy', tier: 1, kind: 'upgrade', name: '血腥狂热', desc: '裂伤斩伤害 +30%', icon: '🔥', parentSkillId: 'skill_lacerate', requires: ['tal_lacerate'], exclusiveGroup: 't1_lacerate', maxRank: 1, modifiers: [{ kind: 'skill_damage_boost', multiplier: 0.3 }] },
];

// ─── 第2级 核心技能（unlockAt=5） ─────────────────────

const T2_SKILLS: TalentNode[] = [
  { id: 'tal_whirlwind', tier: 2, kind: 'skill', name: '旋风斩', desc: '多目标伤害', icon: '🌀', skillId: 'skill_whirlwind', requires: [], maxRank: 1 },
  { id: 'tal_flame_slash', tier: 2, kind: 'skill', name: '烈焰斩', desc: '燃烧持续伤害', icon: '🔥', skillId: 'skill_flame_slash', requires: [], maxRank: 1 },
  { id: 'tal_thunder_charge', tier: 2, kind: 'skill', name: '雷霆突袭', desc: '高伤 + 概率麻痹', icon: '⚡', skillId: 'skill_thunder_charge', requires: [], maxRank: 1 },
];

const T2_UPGRADES: TalentNode[] = [
  // 旋风斩扩展（三选一）
  { id: 'tal_whirlwind_dmg', tier: 2, kind: 'upgrade', name: '旋风强化', desc: '旋风斩伤害 +50%', icon: '💢', parentSkillId: 'skill_whirlwind', requires: ['tal_whirlwind'], exclusiveGroup: 't2_whirlwind', maxRank: 1, modifiers: [{ kind: 'skill_damage_boost', multiplier: 0.5 }] },
  { id: 'tal_whirlwind_rage', tier: 2, kind: 'upgrade', name: '怒气节省', desc: '旋风斩怒气消耗 -15', icon: '🌀', parentSkillId: 'skill_whirlwind', requires: ['tal_whirlwind'], exclusiveGroup: 't2_whirlwind', maxRank: 1, modifiers: [{ kind: 'skill_rage_cost_reduce', reduce: 15 }] },
  { id: 'tal_whirlwind_kb', tier: 2, kind: 'upgrade', name: '附击退', desc: '30% 概率击退（击晕 1 回合）', icon: '💨', parentSkillId: 'skill_whirlwind', requires: ['tal_whirlwind'], exclusiveGroup: 't2_whirlwind', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'stun', chance: 0.3, duration: 1 } }] },
  // 烈焰斩扩展（三选一）
  { id: 'tal_flame_dmg', tier: 2, kind: 'upgrade', name: '燃烧强化', desc: '燃烧伤害 +6/回合', icon: '🔥', parentSkillId: 'skill_flame_slash', requires: ['tal_flame_slash'], exclusiveGroup: 't2_flame_slash', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'burn', value: 6 } }] },
  { id: 'tal_flame_spread', tier: 2, kind: 'upgrade', name: '燃烧扩散', desc: '燃烧持续延长至 5 回合', icon: '🌋', parentSkillId: 'skill_flame_slash', requires: ['tal_flame_slash'], exclusiveGroup: 't2_flame_slash', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'burn', duration: 5 } }] },
  { id: 'tal_flame_crit', tier: 2, kind: 'upgrade', name: '燃烧暴击', desc: '烈焰斩伤害 +50%', icon: '💥', parentSkillId: 'skill_flame_slash', requires: ['tal_flame_slash'], exclusiveGroup: 't2_flame_slash', maxRank: 1, modifiers: [{ kind: 'skill_damage_boost', multiplier: 0.5 }] },
  // 雷霆突袭扩展（三选一）
  { id: 'tal_thunder_para', tier: 2, kind: 'upgrade', name: '麻痹强化', desc: '麻痹概率 +25%', icon: '⚡', parentSkillId: 'skill_thunder_charge', requires: ['tal_thunder_charge'], exclusiveGroup: 't2_thunder_charge', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'paralyse', chance: 0.25 } }] },
  { id: 'tal_thunder_dmg', tier: 2, kind: 'upgrade', name: '雷霆强化', desc: '雷霆突袭伤害 +40%', icon: '🌩️', parentSkillId: 'skill_thunder_charge', requires: ['tal_thunder_charge'], exclusiveGroup: 't2_thunder_charge', maxRank: 1, modifiers: [{ kind: 'skill_damage_boost', multiplier: 0.4 }] },
  { id: 'tal_thunder_chain', tier: 2, kind: 'upgrade', name: '连锁雷电', desc: '额外攻击 2 目标', icon: '🔗', parentSkillId: 'skill_thunder_charge', requires: ['tal_thunder_charge'], exclusiveGroup: 't2_thunder_charge', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'multi_target', extraHits: 2 } }] },
];

// ─── 第3级 防御技能（unlockAt=10） ────────────────────

const T3_SKILLS: TalentNode[] = [
  { id: 'tal_taunt', tier: 3, kind: 'skill', name: '嘲讽', desc: '减伤 + 回怒', icon: '📢', skillId: 'skill_taunt', requires: [], maxRank: 1 },
  { id: 'tal_iron_wall', tier: 3, kind: 'skill', name: '钢铁壁垒', desc: '大幅减伤 + 护盾', icon: '🏰', skillId: 'skill_iron_wall', requires: [], maxRank: 1 },
  { id: 'tal_indomitable', tier: 3, kind: 'skill', name: '不屈意志', desc: '低血量减伤 + 回复', icon: '💪', skillId: 'skill_indomitable', requires: [], maxRank: 1 },
];

const T3_UPGRADES: TalentNode[] = [
  // 嘲讽扩展（三选一）
  { id: 'tal_taunt_def', tier: 3, kind: 'upgrade', name: '坚韧嘲讽', desc: '减伤 +20%', icon: '🛡️', parentSkillId: 'skill_taunt', requires: ['tal_taunt'], exclusiveGroup: 't3_taunt', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'def_up', value: 0.2, duration: 2 } }] },
  { id: 'tal_taunt_counter', tier: 3, kind: 'upgrade', name: '反击', desc: '受击反伤 30%', icon: '🤺', parentSkillId: 'skill_taunt', requires: ['tal_taunt'], exclusiveGroup: 't3_taunt', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'counter', value: 0.3, duration: 2 } }] },
  { id: 'tal_taunt_rage', tier: 3, kind: 'upgrade', name: '怒气回复', desc: '额外回复 20 怒气', icon: '🔥', parentSkillId: 'skill_taunt', requires: ['tal_taunt'], exclusiveGroup: 't3_taunt', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'rage_gain', value: 20 } }] },
  // 钢铁壁垒扩展（三选一）
  { id: 'tal_iron_def', tier: 3, kind: 'upgrade', name: '壁垒强化', desc: '减伤 +15%', icon: '⚔️', parentSkillId: 'skill_iron_wall', requires: ['tal_iron_wall'], exclusiveGroup: 't3_iron_wall', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'def_up', value: 0.15, duration: 1 } }] },
  { id: 'tal_iron_dur', tier: 3, kind: 'upgrade', name: '持久壁垒', desc: '持续 2 回合', icon: '⏳', parentSkillId: 'skill_iron_wall', requires: ['tal_iron_wall'], exclusiveGroup: 't3_iron_wall', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'def_up', value: 0.7, duration: 2 } }] },
  { id: 'tal_iron_counter', tier: 3, kind: 'upgrade', name: '反伤护盾', desc: '护盾存在时反伤 50%', icon: '💫', parentSkillId: 'skill_iron_wall', requires: ['tal_iron_wall'], exclusiveGroup: 't3_iron_wall', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'counter', value: 0.5, duration: 1 } }] },
  // 不屈意志扩展（三选一）
  { id: 'tal_indom_def', tier: 3, kind: 'upgrade', name: '坚定意志', desc: '减伤提升至 70%', icon: '🛡️', parentSkillId: 'skill_indomitable', requires: ['tal_indomitable'], exclusiveGroup: 't3_indomitable', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'indomitable', value: 0.7, duration: 3, chance: 0.4 } }] },
  { id: 'tal_indom_heal', tier: 3, kind: 'upgrade', name: '生机复苏', desc: '额外回复 10% 最大生命', icon: '💚', parentSkillId: 'skill_indomitable', requires: ['tal_indomitable'], exclusiveGroup: 't3_indomitable', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'heal', value: 0.1, duration: 3 } }] },
  { id: 'tal_indom_threshold', tier: 3, kind: 'upgrade', name: '提前触发', desc: '触发阈值提高至 60%', icon: '⬆️', parentSkillId: 'skill_indomitable', requires: ['tal_indomitable'], exclusiveGroup: 't3_indomitable', maxRank: 1, modifiers: [{ kind: 'add_effect', effect: { kind: 'indomitable', value: 0.5, duration: 3, chance: 0.6 } }] },
];

// ─── 组装天赋树 ───────────────────────────────────────

const ALL_NODES: TalentNode[] = [
  LABEL_NODE,
  ...T1_SKILLS, ...T1_UPGRADES,
  ...T2_SKILLS, ...T2_UPGRADES,
  ...T3_SKILLS, ...T3_UPGRADES,
];

export const WARRIOR_TALENT_TREE: TalentTree = {
  class: HeroClass.Warrior,
  label: LABEL_NODE,
  nodes: ALL_NODES,
  tiers: [
    {
      tier: 1,
      label: '基础技能',
      unlockAt: 0,
      skillNodeIds: T1_SKILLS.map(n => n.id),
      upgradeNodeIds: T1_UPGRADES.map(n => n.id),
    },
    {
      tier: 2,
      label: '核心技能',
      unlockAt: 5,
      skillNodeIds: T2_SKILLS.map(n => n.id),
      upgradeNodeIds: T2_UPGRADES.map(n => n.id),
    },
    {
      tier: 3,
      label: '防御技能',
      unlockAt: 10,
      skillNodeIds: T3_SKILLS.map(n => n.id),
      upgradeNodeIds: T3_UPGRADES.map(n => n.id),
    },
  ],
};

// 按 id 查询节点
export const TALENT_NODE_MAP: Record<string, TalentNode> = ALL_NODES.reduce(
  (m, n) => { m[n.id] = n; return m; },
  {} as Record<string, TalentNode>,
);
