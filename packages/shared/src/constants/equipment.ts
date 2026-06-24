/**
 * 装备系统常量 - POE2 风格
 */

import { Rarity, EquipSlot, HeroClass, type PrimaryStats, type ImplicitModDef, type BaseType, type Equipment } from '../types';

// ─── Tier 配置（8 档，T1=最好）──────────────────────────
export const AFFIX_TIERS = [
  { tier: 1, multiplier: 2.0, weight: 2 },
  { tier: 2, multiplier: 1.7, weight: 5 },
  { tier: 3, multiplier: 1.4, weight: 8 },
  { tier: 4, multiplier: 1.2, weight: 12 },
  { tier: 5, multiplier: 1.0, weight: 15 },
  { tier: 6, multiplier: 0.8, weight: 18 },
  { tier: 7, multiplier: 0.6, weight: 20 },
  { tier: 8, multiplier: 0.4, weight: 20 },
] as const;

// ─── 等级缩放系数 ──────────────────────────────────────
export const LEVEL_SCALE_RATE = 0.1; // levelScale = 1 + (ilvl - 1) * 0.1

// ─── 稀有度权重（Apex 不产出）──────────────────────────
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.Normal]: 45,
  [Rarity.Magic]: 30,
  [Rarity.Rare]: 18,
  [Rarity.Epic]: 5,
  [Rarity.Legendary]: 2,
  [Rarity.Apex]: 0,
};

// ─── 稀有度 → 前缀/后缀/特殊词缀位数 ───────────────────
export const RARITY_AFFIX_SLOTS: Record<Rarity, { prefix: number; suffix: number; special: number }> = {
  [Rarity.Normal]: { prefix: 0, suffix: 0, special: 0 },
  [Rarity.Magic]: { prefix: 1, suffix: 1, special: 0 },
  [Rarity.Rare]: { prefix: 2, suffix: 2, special: 0 },
  [Rarity.Epic]: { prefix: 3, suffix: 3, special: 0 },
  [Rarity.Legendary]: { prefix: 3, suffix: 3, special: 1 },
  [Rarity.Apex]: { prefix: 3, suffix: 3, special: 1 },
};

// ─── 稀有度颜色 ────────────────────────────────────────
export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Normal]: '#e0e0e0',
  [Rarity.Magic]: '#4a9eff',
  [Rarity.Rare]: '#ffd700',
  [Rarity.Epic]: '#a335ee',
  [Rarity.Legendary]: '#ff8000',
  [Rarity.Apex]: 'linear-gradient(135deg,#ff3b3b,#a335ee,#1eff00,#00d4ff)',
};

// ─── 稀有度中文名 ──────────────────────────────────────
export const RARITY_NAMES: Record<Rarity, string> = {
  [Rarity.Normal]: '普通',
  [Rarity.Magic]: '魔法',
  [Rarity.Rare]: '稀有',
  [Rarity.Epic]: '史诗',
  [Rarity.Legendary]: '传说',
  [Rarity.Apex]: '至臻',
};

// ─── 装备槽位顺序（equipment 数组索引）──────────────────
export const SLOT_ORDER: EquipSlot[] = [
  EquipSlot.Weapon,
  EquipSlot.OffHand,
  EquipSlot.Armor,
  EquipSlot.Helmet,
  EquipSlot.Boots,
  EquipSlot.Amulet,
  EquipSlot.Ring1,
  EquipSlot.Ring2,
];

export const SLOT_LABELS: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: '武器',
  [EquipSlot.OffHand]: '副手',
  [EquipSlot.Armor]: '胸甲',
  [EquipSlot.Helmet]: '头盔',
  [EquipSlot.Boots]: '鞋子',
  [EquipSlot.Ring1]: '戒指',
  [EquipSlot.Ring2]: '戒指',
  [EquipSlot.Amulet]: '项链',
};

// ─── 基底池（每部位 ≥3，可扩展）────────────────────────

export const BASE_TYPES: BaseType[] = [
  // ── 武器（8 个）──
  { id: 'sword_short', name: '短剑', typeName: '单手剑', slot: EquipSlot.Weapon, itemClass: 'one_hand_sword', minLevel: 1,
    baseStats: { strength: 3 }, implicit: { stat: 'physicalAttack', baseRange: [2, 5], name: '物理攻击' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-sword-basic' },
  { id: 'sword_iron', name: '铁剑', typeName: '单手剑', slot: EquipSlot.Weapon, itemClass: 'one_hand_sword', minLevel: 5,
    baseStats: { strength: 8 }, implicit: { stat: 'physicalAttack', baseRange: [5, 12], name: '物理攻击' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-sword-steel' },
  { id: 'sword_steel', name: '钢剑', typeName: '单手剑', slot: EquipSlot.Weapon, itemClass: 'one_hand_sword', minLevel: 12,
    baseStats: { strength: 15 }, implicit: { stat: 'physicalAttack', baseRange: [10, 25], name: '物理攻击' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-sword-steel' },
  { id: 'sword_great', name: '巨剑', typeName: '双手剑', slot: EquipSlot.Weapon, itemClass: 'two_hand_sword', minLevel: 8,
    baseStats: { strength: 20 }, implicit: { stat: 'physicalAttack', baseRange: [8, 20], name: '物理攻击' },
    twoHanded: true, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-sword-steel' },
  { id: 'axe_battle', name: '战斧', typeName: '单手斧', slot: EquipSlot.Weapon, itemClass: 'one_hand_axe', minLevel: 3,
    baseStats: { strength: 6 }, implicit: { stat: 'physicalAttack', baseRange: [4, 10], name: '物理攻击' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-sword-basic' },
  { id: 'staff_basic', name: '法杖', typeName: '法杖', slot: EquipSlot.Weapon, itemClass: 'staff', minLevel: 1,
    baseStats: { intelligence: 5 }, implicit: { stat: 'magicAttack', baseRange: [2, 5], name: '魔法攻击' },
    twoHanded: true, classRestriction: [HeroClass.Mage], iconClass: 'sprite-icon icon-staff-basic' },
  { id: 'staff_azure', name: '苍蓝法杖', typeName: '法杖', slot: EquipSlot.Weapon, itemClass: 'staff', minLevel: 10,
    baseStats: { intelligence: 14 }, implicit: { stat: 'magicAttack', baseRange: [8, 20], name: '魔法攻击' },
    twoHanded: true, classRestriction: [HeroClass.Mage], iconClass: 'sprite-icon icon-staff-basic' },
  { id: 'bow_short', name: '短弓', typeName: '弓', slot: EquipSlot.Weapon, itemClass: 'bow', minLevel: 1,
    baseStats: { agility: 5 }, implicit: { stat: 'rangedAttack', baseRange: [2, 5], name: '远程攻击' },
    twoHanded: true, classRestriction: [HeroClass.Ranger], iconClass: 'sprite-icon icon-bow-basic' },

  // ── 副手（3 个）──
  { id: 'shield_wood', name: '木盾', typeName: '盾牌', slot: EquipSlot.OffHand, itemClass: 'shield', minLevel: 1,
    baseStats: { vitality: 3 }, implicit: { stat: 'blockRate', baseRange: [0.03, 0.06], name: '格挡率' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-armor-leather' },
  { id: 'shield_iron', name: '铁盾', typeName: '盾牌', slot: EquipSlot.OffHand, itemClass: 'shield', minLevel: 5,
    baseStats: { vitality: 8 }, implicit: { stat: 'blockRate', baseRange: [0.05, 0.10], name: '格挡率' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-armor-plate' },
  { id: 'focus_orb', name: '法器', typeName: '法器', slot: EquipSlot.OffHand, itemClass: 'focus', minLevel: 1,
    baseStats: { intelligence: 3 }, implicit: { stat: 'critRate', baseRange: [0.02, 0.04], name: '暴击率' },
    twoHanded: false, classRestriction: [HeroClass.Mage], iconClass: 'sprite-icon icon-amulet-gem' },

  // ── 胸甲（3 个）──
  { id: 'armor_cloth', name: '布甲', typeName: '胸甲', slot: EquipSlot.Armor, itemClass: 'cloth', minLevel: 1,
    baseStats: { vitality: 3 }, implicit: { stat: 'magicResist', baseRange: [2, 5], name: '魔法抗性' },
    twoHanded: false, classRestriction: [HeroClass.Mage], iconClass: 'sprite-icon icon-armor-cloth' },
  { id: 'armor_leather', name: '皮甲', typeName: '胸甲', slot: EquipSlot.Armor, itemClass: 'leather', minLevel: 3,
    baseStats: { vitality: 6, agility: 3 }, implicit: { stat: 'evade', baseRange: [0.02, 0.04], name: '闪避' },
    twoHanded: false, classRestriction: [HeroClass.Ranger], iconClass: 'sprite-icon icon-armor-leather' },
  { id: 'armor_plate', name: '板甲', typeName: '胸甲', slot: EquipSlot.Armor, itemClass: 'plate', minLevel: 8,
    baseStats: { vitality: 15 }, implicit: { stat: 'armor', baseRange: [5, 12], name: '护甲' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-armor-plate' },

  // ── 头盔（3 个）──
  { id: 'helmet_cap', name: '布帽', typeName: '头盔', slot: EquipSlot.Helmet, itemClass: 'cloth_helmet', minLevel: 1,
    baseStats: { vitality: 2 }, implicit: { stat: 'maxHp', baseRange: [5, 15], name: '生命值' },
    twoHanded: false, classRestriction: [HeroClass.Mage], iconClass: 'sprite-icon icon-helmet-cap' },
  { id: 'helmet_iron', name: '铁盔', typeName: '头盔', slot: EquipSlot.Helmet, itemClass: 'iron_helmet', minLevel: 5,
    baseStats: { vitality: 8 }, implicit: { stat: 'armor', baseRange: [3, 8], name: '护甲' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-helmet-iron' },
  { id: 'helmet_leather', name: '皮帽', typeName: '头盔', slot: EquipSlot.Helmet, itemClass: 'leather_helmet', minLevel: 3,
    baseStats: { agility: 4 }, implicit: { stat: 'evade', baseRange: [0.01, 0.03], name: '闪避' },
    twoHanded: false, classRestriction: [HeroClass.Ranger], iconClass: 'sprite-icon icon-helmet-cap' },

  // ── 鞋子（3 个）──
  { id: 'boots_leather', name: '皮靴', typeName: '鞋子', slot: EquipSlot.Boots, itemClass: 'leather_boots', minLevel: 1,
    baseStats: { agility: 3 }, implicit: { stat: 'evade', baseRange: [0.02, 0.04], name: '闪避' },
    twoHanded: false, classRestriction: [HeroClass.Ranger], iconClass: 'sprite-icon icon-boots-leather' },
  { id: 'boots_iron', name: '铁靴', typeName: '鞋子', slot: EquipSlot.Boots, itemClass: 'iron_boots', minLevel: 5,
    baseStats: { vitality: 5, agility: 3 }, implicit: { stat: 'armor', baseRange: [2, 6], name: '护甲' },
    twoHanded: false, classRestriction: [HeroClass.Warrior], iconClass: 'sprite-icon icon-boots-plate' },
  { id: 'boots_cloth', name: '布鞋', typeName: '鞋子', slot: EquipSlot.Boots, itemClass: 'cloth_boots', minLevel: 1,
    baseStats: { agility: 2 }, implicit: { stat: 'speed', baseRange: [1, 3], name: '速度' },
    twoHanded: false, classRestriction: [HeroClass.Mage], iconClass: 'sprite-icon icon-boots-leather' },

  // ── 戒指（3 个，Ring1 和 Ring2 共用池）──
  { id: 'ring_copper', name: '铜戒', typeName: '戒指', slot: EquipSlot.Ring1, itemClass: 'ring', minLevel: 1,
    baseStats: { luck: 3 }, implicit: { stat: 'luck', baseRange: [1, 3], name: '运气' },
    twoHanded: false, classRestriction: [HeroClass.Warrior, HeroClass.Mage, HeroClass.Ranger], iconClass: 'sprite-icon icon-ring-copper' },
  { id: 'ring_silver', name: '银戒', typeName: '戒指', slot: EquipSlot.Ring1, itemClass: 'ring', minLevel: 5,
    baseStats: { luck: 5, strength: 2, intelligence: 2, agility: 2 }, implicit: { stat: 'luck', baseRange: [2, 5], name: '运气' },
    twoHanded: false, classRestriction: [HeroClass.Warrior, HeroClass.Mage, HeroClass.Ranger], iconClass: 'sprite-icon icon-ring-gold' },
  { id: 'ring_gold', name: '金戒', typeName: '戒指', slot: EquipSlot.Ring1, itemClass: 'ring', minLevel: 10,
    baseStats: { luck: 8 }, implicit: { stat: 'luck', baseRange: [4, 8], name: '运气' },
    twoHanded: false, classRestriction: [HeroClass.Warrior, HeroClass.Mage, HeroClass.Ranger], iconClass: 'sprite-icon icon-ring-gold' },

  // ── 项链（3 个）──
  { id: 'amulet_bone', name: '骨链', typeName: '项链', slot: EquipSlot.Amulet, itemClass: 'amulet', minLevel: 1,
    baseStats: { intelligence: 3 }, implicit: { stat: 'intelligence', baseRange: [1, 3], name: '智力' },
    twoHanded: false, classRestriction: [HeroClass.Warrior, HeroClass.Mage, HeroClass.Ranger], iconClass: 'sprite-icon icon-amulet-bone' },
  { id: 'amulet_charm', name: '护符', typeName: '项链', slot: EquipSlot.Amulet, itemClass: 'amulet', minLevel: 5,
    baseStats: { spirit: 5 }, implicit: { stat: 'spirit', baseRange: [2, 5], name: '精神' },
    twoHanded: false, classRestriction: [HeroClass.Warrior, HeroClass.Mage, HeroClass.Ranger], iconClass: 'sprite-icon icon-amulet-bone' },
  { id: 'amulet_gem', name: '宝石链', typeName: '项链', slot: EquipSlot.Amulet, itemClass: 'amulet', minLevel: 8,
    baseStats: { intelligence: 8, spirit: 5 }, implicit: { stat: 'magicResist', baseRange: [3, 8], name: '魔法抗性' },
    twoHanded: false, classRestriction: [HeroClass.Warrior, HeroClass.Mage, HeroClass.Ranger], iconClass: 'sprite-icon icon-amulet-gem' },
];

// ─── Rare+ 名字池 ──────────────────────────────────────
export const RARE_NAME_POOL = {
  prefix: ['毁灭', '虚空', '暗影', '血月', '霜寂', '雷怒', '深渊', '苍穹', '烈焰', '寒冰', '毒蛇', '圣光', '混沌', '永恒', '狂暴', '守护', '死亡', '生机', '虚幻', '真理'],
  suffix: ['之刃', '之息', '之怒', '之誓', '之痕', '之翼', '之冠', '之魂', '之牙', '之爪', '之心', '之眼', '之风', '之雷', '之焰', '之霜', '之影', '之光', '之梦', '之殇'],
};

// ─── 卖出价格计算 ──────────────────────────────────────
export function calcSellPrice(item: Equipment): number {
  let price = item.itemLevel * 5;
  for (const mod of [...item.prefixes, ...item.suffixes]) {
    price += item.itemLevel * (9 - mod.tier);
  }
  if (item.specialAffix) {
    price += item.itemLevel * 10;
  }
  return Math.floor(price);
}
