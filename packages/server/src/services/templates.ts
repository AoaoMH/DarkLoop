/**
 * 怪物模板数据
 * TODO: 后续从配置文件或数据库加载
 */

import type { Monster, HeroStats } from '@shared/types';

const baseStats: HeroStats = {
  strength: 10,
  agility: 10,
  intelligence: 5,
  vitality: 10,
  critRate: 0.05,
  critDamage: 0.5,
  attackSpeed: 1,
};

export const MONSTER_TEMPLATES: Monster[] = [
  {
    id: 'slime_1',
    templateId: 'slime',
    name: '绿色史莱姆',
    level: 1,
    hp: 50,
    maxHp: 50,
    stats: { ...baseStats, strength: 5 },
    lootTable: [
      { templateId: 'gold', type: 'gold', dropRate: 1, quantity: [5, 15] },
      { templateId: 'exp', type: 'exp', dropRate: 1, quantity: [10, 20] },
      { templateId: 'sword_basic', type: 'equipment', dropRate: 0.3 },
    ],
  },
  {
    id: 'skeleton_1',
    templateId: 'skeleton',
    name: '骷髅战士',
    level: 5,
    hp: 200,
    maxHp: 200,
    stats: { ...baseStats, strength: 15, vitality: 12 },
    lootTable: [
      { templateId: 'gold', type: 'gold', dropRate: 1, quantity: [20, 50] },
      { templateId: 'exp', type: 'exp', dropRate: 1, quantity: [30, 60] },
      { templateId: 'armor_basic', type: 'equipment', dropRate: 0.25 },
    ],
  },
  {
    id: 'demon_1',
    templateId: 'demon',
    name: '深渊恶魔',
    level: 10,
    hp: 800,
    maxHp: 800,
    stats: { ...baseStats, strength: 30, vitality: 25, critRate: 0.1 },
    lootTable: [
      { templateId: 'gold', type: 'gold', dropRate: 1, quantity: [80, 200] },
      { templateId: 'exp', type: 'exp', dropRate: 1, quantity: [100, 250] },
      { templateId: 'epic_sword', type: 'equipment', dropRate: 0.15 },
      { templateId: 'pet_imp', type: 'pet', dropRate: 0.05 },
    ],
  },
];

/** 根据关卡获取怪物 */
export function getMonsterForStage(stage: number): Monster {
  // 简单的关卡 -> 怪物映射，后续可扩展为波次系统
  const idx = Math.min(Math.floor(stage / 5), MONSTER_TEMPLATES.length - 1);
  const template = MONSTER_TEMPLATES[idx];

  // 关卡越高，怪物越强
  const scale = 1 + (stage - 1) * 0.1;

  return {
    ...template,
    level: Math.floor(template.level * scale),
    hp: Math.floor(template.hp * scale),
    maxHp: Math.floor(template.maxHp * scale),
    stats: {
      ...template.stats,
      strength: Math.floor(template.stats.strength * scale),
      vitality: Math.floor(template.stats.vitality * scale),
    },
  };
}
