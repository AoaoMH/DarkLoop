/**
 * 装备系统常量
 */

import { Rarity, EquipSlot, type HeroStats } from '../types';

// 词缀品阶配置
export const AFFIX_TIERS = [
  { tier: 1, min: 1,  max: 5,   weight: 0.5 },
  { tier: 2, min: 5,  max: 12,  weight: 0.3 },
  { tier: 3, min: 10, max: 25,  weight: 0.15 },
  { tier: 4, min: 20, max: 50,  weight: 0.04 },
  { tier: 5, min: 40, max: 100, weight: 0.01 },
];

// 稀有度权重（神话/至臻默认不产出）
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.Common]: 50,
  [Rarity.Fine]: 30,
  [Rarity.Rare]: 14,
  [Rarity.Epic]: 5,
  [Rarity.Legendary]: 1,
  [Rarity.Mythic]: 0,
  [Rarity.Apex]: 0,
};

// 稀有度颜色：普通白/优秀绿/稀有蓝/史诗紫/传说橙/神话红/至臻炫彩
export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: '#e0e0e0',
  [Rarity.Fine]: '#1eff00',
  [Rarity.Rare]: '#0070dd',
  [Rarity.Epic]: '#a335ee',
  [Rarity.Legendary]: '#ff8000',
  [Rarity.Mythic]: '#ff3b3b',
  [Rarity.Apex]: 'linear-gradient(135deg,#ff3b3b,#a335ee,#1eff00,#00d4ff)',
};

// 稀有度中文名
export const RARITY_NAMES: Record<Rarity, string> = {
  [Rarity.Common]: '普通',
  [Rarity.Fine]: '优秀',
  [Rarity.Rare]: '稀有',
  [Rarity.Epic]: '史诗',
  [Rarity.Legendary]: '传说',
  [Rarity.Mythic]: '神话',
  [Rarity.Apex]: '至臻',
};

// 装备模板
interface EquipTemplate {
  id: string;
  name: string;
  slot: EquipSlot;
  minLevel: number;
  baseStats: Partial<HeroStats>;
  icon: string;
}

export const EQUIP_TEMPLATES: EquipTemplate[] = [
  // 武器
  { id: 'sword_basic',    name: '铁剑',   slot: EquipSlot.Weapon, minLevel: 1,  baseStats: { strength: 5 },  icon: '🗡️' },
  { id: 'sword_steel',    name: '钢剑',   slot: EquipSlot.Weapon, minLevel: 5,  baseStats: { strength: 15 }, icon: '⚔️' },
  { id: 'staff_basic',    name: '法杖',   slot: EquipSlot.Weapon, minLevel: 1,  baseStats: { intelligence: 5 }, icon: '🪄' },
  { id: 'bow_basic',      name: '短弓',   slot: EquipSlot.Weapon, minLevel: 1,  baseStats: { agility: 5 },  icon: '🏹' },
  // 防具
  { id: 'armor_cloth',    name: '布甲',   slot: EquipSlot.Armor,  minLevel: 1,  baseStats: { vitality: 3 },  icon: '👕' },
  { id: 'armor_leather',  name: '皮甲',   slot: EquipSlot.Armor,  minLevel: 3,  baseStats: { vitality: 8 },  icon: '🧥' },
  { id: 'armor_plate',    name: '板甲',   slot: EquipSlot.Armor,  minLevel: 8,  baseStats: { vitality: 20 }, icon: '🛡️' },
  // 头盔
  { id: 'helmet_cap',     name: '布帽',   slot: EquipSlot.Helmet, minLevel: 1,  baseStats: { vitality: 2 },  icon: '🎩' },
  { id: 'helmet_iron',    name: '铁盔',   slot: EquipSlot.Helmet, minLevel: 5,  baseStats: { vitality: 10 }, icon: '⛑️' },
  // 鞋子
  { id: 'boots_leather',  name: '皮靴',   slot: EquipSlot.Boots,  minLevel: 1,  baseStats: { agility: 3 },   icon: '👢' },
  { id: 'boots_plate',    name: '铁靴',   slot: EquipSlot.Boots,  minLevel: 5,  baseStats: { agility: 8, vitality: 5 }, icon: '🥾' },
  // 戒指
  { id: 'ring_copper',    name: '铜戒',   slot: EquipSlot.Ring,   minLevel: 1,  baseStats: { luck: 3 }, icon: '💍' },
  { id: 'ring_gold',      name: '金戒',   slot: EquipSlot.Ring,   minLevel: 8,  baseStats: { luck: 8 }, icon: '💍' },
  // 项链
  { id: 'amulet_bone',    name: '骨链',   slot: EquipSlot.Amulet, minLevel: 1,  baseStats: { intelligence: 3 }, icon: '📿' },
  { id: 'amulet_gem',     name: '宝石链', slot: EquipSlot.Amulet, minLevel: 8,  baseStats: { intelligence: 12, spirit: 5 }, icon: '📿' },
];
