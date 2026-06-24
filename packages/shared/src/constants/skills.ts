/**
 * 战士技能 - 怒气消耗制
 * 重击为初始技能（不在天赋树）；其余 9 个主动技能通过天赋树学习
 * 三级：基础技能（盾击/蓄力一击/裂伤斩）、核心技能（旋风斩/烈焰斩/雷霆突袭）、防御技能（嘲讽/钢铁壁垒/不屈意志）
 */

import { SkillType, type Skill } from '../types';

export const WARRIOR_SKILLS: Skill[] = [
  // ─── 初始技能（默认拥有，不在天赋树） ─────────────────
  {
    id: 'skill_heavy_strike',
    name: '重击',
    type: SkillType.Active,
    description: '造成 180% 物理伤害',
    cooldown: 0,
    damageMultiplier: 1.8,
    level: 1,
    maxLevel: 10,
    icon: '⚔️',
    effectName: 'slash_01.png',
    rageCost: 30,
  },

  // ─── 第1级 基础技能 ─────────────────────────────────
  {
    id: 'skill_shield_bash',
    name: '盾击',
    type: SkillType.Active,
    description: '造成 130% 伤害，35% 概率击晕敌人 1 回合',
    cooldown: 0,
    damageMultiplier: 1.3,
    level: 1,
    maxLevel: 10,
    icon: '🛡️',
    effectName: 'circle_01.png',
    rageCost: 25,
    effects: [{ kind: 'stun', chance: 0.35, duration: 1 }],
  },
  {
    id: 'skill_charge_strike',
    name: '蓄力一击',
    type: SkillType.Active,
    description: '本回合蓄力（防御姿态），下回合再次释放造成 250% 伤害且暴击率 +30%',
    cooldown: 0,
    damageMultiplier: 2.5,
    level: 1,
    maxLevel: 10,
    icon: '⚡',
    effectName: 'spark_01.png',
    rageCost: 30,
    chargeSkill: true,
  },
  {
    id: 'skill_lacerate',
    name: '裂伤斩',
    type: SkillType.Active,
    description: '造成 110% 伤害，附加流血 3 回合（每回合 8 点伤害）',
    cooldown: 0,
    damageMultiplier: 1.1,
    level: 1,
    maxLevel: 10,
    icon: '🗡️',
    effectName: 'slash_03.png',
    rageCost: 20,
    effects: [{ kind: 'bleed', value: 8, duration: 3 }],
  },

  // ─── 第2级 核心技能 ─────────────────────────────────
  {
    id: 'skill_whirlwind',
    name: '旋风斩',
    type: SkillType.Active,
    description: '造成 100% 伤害，额外攻击 2 个目标（每个 50% 伤害）',
    cooldown: 0,
    damageMultiplier: 1.0,
    level: 1,
    maxLevel: 10,
    icon: '🌀',
    effectName: 'twirl_01.png',
    rageCost: 50,
    effects: [{ kind: 'multi_target', extraHits: 2 }],
  },
  {
    id: 'skill_flame_slash',
    name: '烈焰斩',
    type: SkillType.Active,
    description: '造成 140% 伤害，附加燃烧 3 回合（每回合 12 点伤害）',
    cooldown: 0,
    damageMultiplier: 1.4,
    level: 1,
    maxLevel: 10,
    icon: '🔥',
    effectName: 'fire_01.png',
    rageCost: 40,
    effects: [{ kind: 'burn', value: 12, duration: 3 }],
  },
  {
    id: 'skill_thunder_charge',
    name: '雷霆突袭',
    type: SkillType.Active,
    description: '造成 180% 伤害，25% 概率麻痹敌人 2 回合',
    cooldown: 0,
    damageMultiplier: 1.8,
    level: 1,
    maxLevel: 10,
    icon: '⚡',
    effectName: 'light_01.png',
    rageCost: 45,
    effects: [{ kind: 'paralyse', chance: 0.25, duration: 2 }],
  },

  // ─── 第3级 防御技能 ─────────────────────────────────
  {
    id: 'skill_taunt',
    name: '嘲讽',
    type: SkillType.Active,
    description: '减伤 30%（2 回合），回复 15 怒气',
    cooldown: 0,
    damageMultiplier: 0,
    level: 1,
    maxLevel: 10,
    icon: '📢',
    effectName: 'magic_04.png',
    rageCost: 25,
    selfEffects: [
      { kind: 'def_up', value: 0.3, duration: 2 },
      { kind: 'rage_gain', value: 15 },
    ],
  },
  {
    id: 'skill_iron_wall',
    name: '钢铁壁垒',
    type: SkillType.Active,
    description: '减伤 70%（1 回合），获得 30 点护盾',
    cooldown: 0,
    damageMultiplier: 0,
    level: 1,
    maxLevel: 10,
    icon: '🏰',
    effectName: 'magic_02.png',
    rageCost: 50,
    selfEffects: [
      { kind: 'def_up', value: 0.7, duration: 1 },
      { kind: 'shield', value: 30 },
    ],
  },
  {
    id: 'skill_indomitable',
    name: '不屈意志',
    type: SkillType.Active,
    description: '3 回合内，血量低于 40% 时减伤 50% 并回复 15% 最大生命',
    cooldown: 0,
    damageMultiplier: 0,
    level: 1,
    maxLevel: 10,
    icon: '💪',
    effectName: 'flare_01.png',
    rageCost: 30,
    selfEffects: [{ kind: 'indomitable', value: 0.4, duration: 3 }],
  },
];

// 初始技能（战士新建时携带）
export const WARRIOR_STARTER_SKILL_IDS = ['skill_heavy_strike'];

// 按 id 查询技能
export const SKILL_MAP: Record<string, Skill> = WARRIOR_SKILLS.reduce(
  (m, s) => { m[s.id] = s; return m; },
  {} as Record<string, Skill>,
);
