/**
 * 怪物模板定义
 * 每个模板定义 1 级基础属性和每级成长率，关卡引用时设置等级即可
 */

import type { MonsterTemplate } from '../types';

export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  // ── 区域1：史莱姆平原 ──
  slime_green: {
    id: 'slime_green',
    name: '绿史莱姆',
    baseStats: { strength: 3, agility: 2, intelligence: 1, vitality: 2, spirit: 1, luck: 1 },
    statGrowth: { strength: 0.8, agility: 0.6, vitality: 1.2, intelligence: 0.3, spirit: 0.3, luck: 0.2 },
    skills: ['mob_tackle', 'mob_acid_spit'],
    tags: [],
    icon: '👾',
    loot: [{ templateId: 'sword_basic', type: 'equipment', dropRate: 0.08 }],
  },
  slime_blue: {
    id: 'slime_blue',
    name: '蓝史莱姆',
    baseStats: { strength: 4, agility: 3, intelligence: 4, vitality: 3, spirit: 2, luck: 1 },
    statGrowth: { strength: 1.0, agility: 0.8, vitality: 1.5, intelligence: 1.2, spirit: 0.5, luck: 0.3 },
    skills: ['mob_tackle', 'mob_frost_nova'],
    tags: ['element'],
    icon: '🔵',
    isElite: true,
    loot: [{ templateId: 'sword_steel', type: 'equipment', dropRate: 0.15 }],
  },
  bat: {
    id: 'bat',
    name: '吸血蝙蝠',
    baseStats: { strength: 3, agility: 6, intelligence: 2, vitality: 2, spirit: 1, luck: 2 },
    statGrowth: { strength: 0.6, agility: 1.5, vitality: 0.8, intelligence: 0.4, spirit: 0.3, luck: 0.3 },
    skills: ['mob_tackle', 'mob_poison_strike'],
    tags: ['beast'],
    icon: '🦇',
    loot: [],
  },
  giant_rat: {
    id: 'giant_rat',
    name: '巨鼠',
    baseStats: { strength: 4, agility: 5, intelligence: 1, vitality: 3, spirit: 1, luck: 1 },
    statGrowth: { strength: 0.9, agility: 1.2, vitality: 1.0, intelligence: 0.2, spirit: 0.2, luck: 0.2 },
    skills: ['mob_tackle', 'mob_poison_strike'],
    tags: ['beast'],
    icon: '🐀',
    loot: [],
  },
  slime_king: {
    id: 'slime_king',
    name: '史莱姆王',
    baseStats: { strength: 8, agility: 4, intelligence: 3, vitality: 10, spirit: 3, luck: 3 },
    statGrowth: { strength: 1.8, agility: 1.0, vitality: 3.0, intelligence: 0.8, spirit: 0.8, luck: 0.5 },
    skills: ['mob_tackle', 'mob_slam', 'mob_split', 'mob_heal'],
    tags: [],
    icon: '👑',
    isBoss: true,
    loot: [{ templateId: 'sword_basic', type: 'equipment', dropRate: 0.4 }],
  },

  // ── 区域2：骸骨墓地 ──
  skeleton: {
    id: 'skeleton',
    name: '骷髅兵',
    baseStats: { strength: 6, agility: 5, intelligence: 2, vitality: 4, spirit: 1, luck: 1 },
    statGrowth: { strength: 1.3, agility: 1.0, vitality: 1.5, intelligence: 0.4, spirit: 0.3, luck: 0.3 },
    skills: ['mob_tackle', 'mob_bone_shield'],
    tags: ['undead'],
    icon: '💀',
    loot: [{ templateId: 'sword_steel', type: 'equipment', dropRate: 0.08 }],
  },
  skeleton_archer: {
    id: 'skeleton_archer',
    name: '骷髅弓手',
    baseStats: { strength: 4, agility: 8, intelligence: 2, vitality: 3, spirit: 1, luck: 2 },
    statGrowth: { strength: 0.8, agility: 1.8, vitality: 1.0, intelligence: 0.4, spirit: 0.3, luck: 0.4 },
    skills: ['mob_arrow_shot', 'mob_acid_spit'],
    tags: ['undead'],
    icon: '🏹',
    isElite: true,
    loot: [{ templateId: 'armor_leather', type: 'equipment', dropRate: 0.15 }],
  },
  zombie: {
    id: 'zombie',
    name: '腐尸',
    baseStats: { strength: 7, agility: 2, intelligence: 1, vitality: 8, spirit: 1, luck: 1 },
    statGrowth: { strength: 1.5, agility: 0.4, vitality: 2.5, intelligence: 0.2, spirit: 0.3, luck: 0.2 },
    skills: ['mob_tackle', 'mob_poison_strike'],
    tags: ['undead'],
    icon: '🧟',
    loot: [],
  },
  skeleton_lord: {
    id: 'skeleton_lord',
    name: '骷髅领主',
    baseStats: { strength: 12, agility: 8, intelligence: 4, vitality: 10, spirit: 3, luck: 3 },
    statGrowth: { strength: 2.5, agility: 1.8, vitality: 2.5, intelligence: 0.8, spirit: 0.6, luck: 0.5 },
    skills: ['mob_tackle', 'mob_slam', 'mob_bone_shield', 'mob_curse'],
    tags: ['undead'],
    icon: '☠️',
    isBoss: true,
    loot: [{ templateId: 'armor_leather', type: 'equipment', dropRate: 0.4 }],
  },

  // ── 区域3：恶魔巢穴 ──
  imp: {
    id: 'imp',
    name: '小恶魔',
    baseStats: { strength: 6, agility: 7, intelligence: 8, vitality: 5, spirit: 3, luck: 3 },
    statGrowth: { strength: 1.2, agility: 1.5, vitality: 1.2, intelligence: 2.0, spirit: 0.6, luck: 0.5 },
    skills: ['mob_fireball', 'mob_curse'],
    tags: ['element', 'demon'],
    icon: '👺',
    loot: [{ templateId: 'armor_plate', type: 'equipment', dropRate: 0.08 }],
  },
  hellhound: {
    id: 'hellhound',
    name: '地狱犬',
    baseStats: { strength: 10, agility: 8, intelligence: 3, vitality: 7, spirit: 2, luck: 2 },
    statGrowth: { strength: 2.0, agility: 1.5, vitality: 1.8, intelligence: 0.5, spirit: 0.4, luck: 0.3 },
    skills: ['mob_tackle', 'mob_rage'],
    tags: ['beast', 'demon'],
    icon: '🐕',
    loot: [],
  },
  demon_brute: {
    id: 'demon_brute',
    name: '恶魔蛮兵',
    baseStats: { strength: 14, agility: 5, intelligence: 4, vitality: 12, spirit: 3, luck: 2 },
    statGrowth: { strength: 2.8, agility: 1.0, vitality: 2.8, intelligence: 0.6, spirit: 0.5, luck: 0.3 },
    skills: ['mob_tackle', 'mob_slam', 'mob_rage'],
    tags: ['demon'],
    icon: '👹',
    isElite: true,
    loot: [{ templateId: 'helmet_iron', type: 'equipment', dropRate: 0.2 }],
  },
  demon_caster: {
    id: 'demon_caster',
    name: '恶魔术士',
    baseStats: { strength: 5, agility: 6, intelligence: 12, vitality: 6, spirit: 5, luck: 3 },
    statGrowth: { strength: 0.8, agility: 1.2, vitality: 1.5, intelligence: 2.5, spirit: 1.0, luck: 0.5 },
    skills: ['mob_fireball', 'mob_curse', 'mob_frost_nova'],
    tags: ['element', 'demon'],
    icon: '😈',
    loot: [],
  },
  demon_lord: {
    id: 'demon_lord',
    name: '恶魔统领',
    baseStats: { strength: 18, agility: 10, intelligence: 8, vitality: 16, spirit: 5, luck: 5 },
    statGrowth: { strength: 3.5, agility: 2.0, vitality: 3.5, intelligence: 1.5, spirit: 1.0, luck: 0.8 },
    skills: ['mob_tackle', 'mob_slam', 'mob_fireball', 'mob_rage', 'mob_heal'],
    tags: ['element', 'demon'],
    icon: '👿',
    isBoss: true,
    loot: [{ templateId: 'helmet_iron', type: 'equipment', dropRate: 0.5 }],
  },
};

/** 根据 ID 获取怪物模板 */
export function getMonsterTemplate(id: string): MonsterTemplate | undefined {
  return MONSTER_TEMPLATES[id];
}
