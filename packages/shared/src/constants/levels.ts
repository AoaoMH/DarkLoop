/**
 * 关卡定义 - v1 共 3 关，平缓难度曲线
 * 每关 4 波：wave1-3 小怪，wave4 boss
 */

import type { LevelDef } from '../types';

export const LEVELS: LevelDef[] = [
  {
    id: 'lv1_slime_plains',
    name: '史莱姆平原',
    desc: '新手冒险者的试炼之地，史莱姆成群出没。',
    difficulty: 1,
    recommendLevel: 1,
    waves: [
      { monsters: [{ id: 'slime_green', name: '绿史莱姆', level: 1, baseStats: { strength: 2, agility: 2, intelligence: 1, vitality: 1, spirit: 1, luck: 1 }, tags: [], icon: '🟢', loot: [{ templateId: 'sword_basic', type: 'equipment', dropRate: 0.1 }] }] },
      { monsters: [{ id: 'slime_green', name: '绿史莱姆', level: 1, baseStats: { strength: 2, agility: 2, intelligence: 1, vitality: 1, spirit: 1, luck: 1 }, tags: [], icon: '🟢', loot: [] }] },
      { monsters: [{ id: 'slime_green', name: '绿史莱姆', level: 1, baseStats: { strength: 2, agility: 2, intelligence: 1, vitality: 1, spirit: 1, luck: 1 }, tags: [], icon: '🟢', loot: [] }] },
      { monsters: [{ id: 'slime_king', name: '史莱姆王', level: 2, baseStats: { strength: 5, agility: 3, intelligence: 2, vitality: 3, spirit: 2, luck: 2 }, tags: [], icon: '👑', isBoss: true, loot: [{ templateId: 'sword_basic', type: 'equipment', dropRate: 0.3 }] }] },
    ],
    firstClearReward: { gems: 10, badge: 1 },
  },
  {
    id: 'lv2_skeleton_graveyard',
    name: '骸骨墓地',
    desc: '阴森的墓地中，亡灵战士永不安息。',
    difficulty: 2,
    recommendLevel: 3,
    waves: [
      { monsters: [{ id: 'skeleton', name: '骷髅兵', level: 3, baseStats: { strength: 8, agility: 8, intelligence: 3, vitality: 3, spirit: 1, luck: 1 }, tags: ['undead'], icon: '💀', loot: [{ templateId: 'sword_steel', type: 'equipment', dropRate: 0.1 }] }] },
      { monsters: [{ id: 'skeleton', name: '骷髅兵', level: 3, baseStats: { strength: 8, agility: 8, intelligence: 3, vitality: 3, spirit: 1, luck: 1 }, tags: ['undead'], icon: '💀', loot: [] }] },
      { monsters: [{ id: 'skeleton', name: '骷髅兵', level: 3, baseStats: { strength: 8, agility: 8, intelligence: 3, vitality: 3, spirit: 1, luck: 1 }, tags: ['undead'], icon: '💀', loot: [] }] },
      { monsters: [{ id: 'skeleton_lord', name: '骷髅领主', level: 4, baseStats: { strength: 15, agility: 10, intelligence: 5, vitality: 12, spirit: 2, luck: 2 }, tags: ['undead'], icon: '☠️', isBoss: true, loot: [{ templateId: 'armor_leather', type: 'equipment', dropRate: 0.3 }] }] },
    ],
    firstClearReward: { gems: 20, badge: 1 },
  },
  {
    id: 'lv3_demon_lair',
    name: '恶魔巢穴',
    desc: '深入地底，直面恶魔军团的巢穴。',
    difficulty: 3,
    recommendLevel: 5,
    waves: [
      { monsters: [{ id: 'imp', name: '小恶魔', level: 5, baseStats: { strength: 16, agility: 12, intelligence: 8, vitality: 8, spirit: 3, luck: 3 }, tags: ['element'], icon: '👺', loot: [{ templateId: 'armor_plate', type: 'equipment', dropRate: 0.1 }] }] },
      { monsters: [{ id: 'imp', name: '小恶魔', level: 5, baseStats: { strength: 16, agility: 12, intelligence: 8, vitality: 8, spirit: 3, luck: 3 }, tags: ['element'], icon: '👺', loot: [] }] },
      { monsters: [{ id: 'imp', name: '小恶魔', level: 5, baseStats: { strength: 16, agility: 12, intelligence: 8, vitality: 8, spirit: 3, luck: 3 }, tags: ['element'], icon: '👺', loot: [] }] },
      { monsters: [{ id: 'demon_lord', name: '恶魔统领', level: 7, baseStats: { strength: 28, agility: 16, intelligence: 10, vitality: 25, spirit: 5, luck: 5 }, tags: ['element'], icon: '😈', isBoss: true, loot: [{ templateId: 'helmet_iron', type: 'equipment', dropRate: 0.4 }] }] },
    ],
    firstClearReward: { gems: 30, badge: 1 },
  },
];

export function getLevelById(id: string): LevelDef | undefined {
  return LEVELS.find(l => l.id === id);
}
