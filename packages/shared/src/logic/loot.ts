/**
 * 装备/掉落生成器 - POE2 风格
 * 基底 + 隐式词缀 + 前缀 + 后缀 + 特殊词缀(Legendary)
 * 词缀池按 prefix/suffix 分离，含 mod group 防重复
 */

import type {
  Equipment, RolledMod, AffixDef, AffixTag, AffixStatKey, AffixKind,
  BaseType, ImplicitModDef,
} from '../types';
import { Rarity, EquipSlot, HeroClass } from '../types';
import {
  AFFIX_TIERS, RARITY_WEIGHTS, RARITY_AFFIX_SLOTS, LEVEL_SCALE_RATE,
  BASE_TYPES, RARE_NAME_POOL,
} from '../constants/equipment';

// ─── 百分比属性判定 ─────────────────────────────────────
const PERCENT_STATS: AffixStatKey[] = [
  'critRate', 'critDamage', 'evade', 'blockRate', 'blockPercent',
  'armorPierce', 'magicPierce', 'physicalLeech', 'magicLeech',
  'cooldownReduction', 'statusResist', 'damageReflect', 'accuracy',
  'inc_damage', 'more_damage', 'elite_damage', 'boss_damage',
  'bleed_chance', 'gold_bonus', 'exp_bonus', 'luck_bonus',
];

function isPercentStat(stat: AffixStatKey): boolean {
  return PERCENT_STATS.includes(stat);
}

// ─── 前缀词缀池（偏攻击）────────────────────────────────
export const PREFIX_DEFS: AffixDef[] = [
  // 攻击属性
  { id: 'pre_phys_atk', name: '物理攻击', kind: 'prefix', group: 'physical_attack',
    tags: ['universal', 'weapon', 'offensive', 'physical', 'warrior'],
    stat: 'physicalAttack', baseRange: [3, 15], nameWord: { prefix: '锋利' } },
  { id: 'pre_ranged_atk', name: '远程攻击', kind: 'prefix', group: 'ranged_attack',
    tags: ['universal', 'weapon', 'offensive', 'ranged', 'ranger'],
    stat: 'rangedAttack', baseRange: [3, 15], nameWord: { prefix: '精准' } },
  { id: 'pre_magic_atk', name: '魔法攻击', kind: 'prefix', group: 'magic_attack',
    tags: ['universal', 'weapon', 'offensive', 'magic', 'mage'],
    stat: 'magicAttack', baseRange: [3, 15], nameWord: { prefix: '附魔' } },
  { id: 'pre_crit_dmg', name: '暴击伤害', kind: 'prefix', group: 'crit_damage',
    tags: ['universal', 'weapon', 'offensive'],
    stat: 'critDamage', baseRange: [0.1, 0.5], nameWord: { prefix: '致命' } },
  { id: 'pre_inc_dmg', name: '全域伤害', kind: 'prefix', group: 'increased_damage',
    tags: ['universal', 'weapon', 'offensive'],
    stat: 'inc_damage', baseRange: [0.05, 0.15], nameWord: { prefix: '毁灭' } },
  { id: 'pre_more_dmg', name: '额外伤害', kind: 'prefix', group: 'more_damage',
    tags: ['universal', 'weapon', 'offensive'],
    stat: 'more_damage', baseRange: [0.05, 0.15], nameWord: { prefix: '狂暴' } },
  // 主属性
  { id: 'pre_str', name: '力量', kind: 'prefix', group: 'primary_str',
    tags: ['universal', 'offensive', 'warrior'],
    stat: 'strength', baseRange: [2, 8], nameWord: { prefix: '巨力' } },
  { id: 'pre_agi', name: '敏捷', kind: 'prefix', group: 'primary_agi',
    tags: ['universal', 'offensive', 'ranger'],
    stat: 'agility', baseRange: [2, 8], nameWord: { prefix: '迅捷' } },
  { id: 'pre_int', name: '智力', kind: 'prefix', group: 'primary_int',
    tags: ['universal', 'offensive', 'mage'],
    stat: 'intelligence', baseRange: [2, 8], nameWord: { prefix: '睿智' } },
  // 穿透
  { id: 'pre_armor_pierce', name: '护甲穿透', kind: 'prefix', group: 'armor_pierce',
    tags: ['universal', 'weapon', 'offensive', 'physical'],
    stat: 'armorPierce', baseRange: [0.02, 0.12], nameWord: { prefix: '破甲' } },
  { id: 'pre_magic_pierce', name: '魔法穿透', kind: 'prefix', group: 'magic_pierce',
    tags: ['universal', 'weapon', 'offensive', 'magic'],
    stat: 'magicPierce', baseRange: [0.02, 0.12], nameWord: { prefix: '穿透' } },
  // 吸血
  { id: 'pre_phys_leech', name: '物理吸血', kind: 'prefix', group: 'physical_leech',
    tags: ['universal', 'weapon', 'offensive', 'physical'],
    stat: 'physicalLeech', baseRange: [0.01, 0.05], nameWord: { prefix: '嗜血' } },
  { id: 'pre_magic_leech', name: '魔法吸血', kind: 'prefix', group: 'magic_leech',
    tags: ['universal', 'weapon', 'offensive', 'magic'],
    stat: 'magicLeech', baseRange: [0.01, 0.05], nameWord: { prefix: '虹吸' } },
  // 特殊伤害
  { id: 'pre_elite_dmg', name: '精英伤害', kind: 'prefix', group: 'elite_damage',
    tags: ['universal', 'weapon', 'offensive'],
    stat: 'elite_damage', baseRange: [0.05, 0.20], nameWord: { prefix: '猎手' } },
  { id: 'pre_boss_dmg', name: '首领伤害', kind: 'prefix', group: 'boss_damage',
    tags: ['universal', 'weapon', 'offensive'],
    stat: 'boss_damage', baseRange: [0.05, 0.20], nameWord: { prefix: '屠戮' } },
  { id: 'pre_bleed', name: '流血概率', kind: 'prefix', group: 'bleed',
    tags: ['universal', 'weapon', 'offensive', 'physical'],
    stat: 'bleed_chance', baseRange: [0.05, 0.15], nameWord: { prefix: '撕裂' } },
  // 生命
  { id: 'pre_vit', name: '体质', kind: 'prefix', group: 'primary_vit',
    tags: ['universal', 'defensive'],
    stat: 'vitality', baseRange: [2, 8], nameWord: { prefix: '坚韧' } },
  { id: 'pre_max_hp', name: '生命值', kind: 'prefix', group: 'max_hp',
    tags: ['universal', 'defensive'],
    stat: 'maxHp', baseRange: [10, 40], nameWord: { prefix: '生命' } },
  { id: 'pre_hp_regen', name: '生命回复', kind: 'prefix', group: 'hp_regen',
    tags: ['universal', 'defensive'],
    stat: 'hpRegen', baseRange: [2, 10], nameWord: { prefix: '复苏' } },
];

// ─── 后缀词缀池（偏防御/辅助）──────────────────────────
export const SUFFIX_DEFS: AffixDef[] = [
  // 防御属性
  { id: 'suf_armor', name: '护甲', kind: 'suffix', group: 'armor',
    tags: ['universal', 'armor', 'helmet', 'boots', 'defensive'],
    stat: 'armor', baseRange: [3, 15], nameWord: { suffix: '守护' } },
  { id: 'suf_magic_resist', name: '魔法抗性', kind: 'suffix', group: 'magic_resist',
    tags: ['universal', 'armor', 'helmet', 'boots', 'defensive'],
    stat: 'magicResist', baseRange: [3, 15], nameWord: { suffix: '抗魔' } },
  { id: 'suf_block_rate', name: '格挡率', kind: 'suffix', group: 'block_rate',
    tags: ['universal', 'offhand', 'defensive', 'physical', 'warrior'],
    stat: 'blockRate', baseRange: [0.02, 0.08], nameWord: { suffix: '格挡' } },
  { id: 'suf_block_value', name: '格挡值', kind: 'suffix', group: 'block_value',
    tags: ['universal', 'offhand', 'defensive', 'physical', 'warrior'],
    stat: 'blockValue', baseRange: [2, 10], nameWord: { suffix: '壁垒' } },
  // 暴击/命中/闪避
  { id: 'suf_crit_rate', name: '暴击率', kind: 'suffix', group: 'crit_rate',
    tags: ['universal', 'weapon', 'ring', 'amulet', 'offensive'],
    stat: 'critRate', baseRange: [0.01, 0.05], nameWord: { suffix: '锐利' } },
  { id: 'suf_accuracy', name: '命中', kind: 'suffix', group: 'accuracy',
    tags: ['universal', 'weapon', 'offensive'],
    stat: 'accuracy', baseRange: [0.01, 0.05], nameWord: { suffix: '命中' } },
  { id: 'suf_evade', name: '闪避', kind: 'suffix', group: 'evade',
    tags: ['universal', 'armor', 'helmet', 'boots', 'defensive'],
    stat: 'evade', baseRange: [0.01, 0.05], nameWord: { suffix: '回避' } },
  // 通用辅助
  { id: 'suf_speed', name: '速度', kind: 'suffix', group: 'speed',
    tags: ['universal', 'boots', 'support'],
    stat: 'speed', baseRange: [1, 8], nameWord: { suffix: '疾风' } },
  { id: 'suf_status_resist', name: '异常抗性', kind: 'suffix', group: 'status_resist',
    tags: ['universal', 'armor', 'helmet', 'defensive'],
    stat: 'statusResist', baseRange: [0.01, 0.05], nameWord: { suffix: '净化' } },
  { id: 'suf_dmg_reflect', name: '伤害反弹', kind: 'suffix', group: 'damage_reflect',
    tags: ['universal', 'armor', 'helmet', 'defensive'],
    stat: 'damageReflect', baseRange: [0.01, 0.05], nameWord: { suffix: '荆棘' } },
  // 副属性
  { id: 'suf_spi', name: '精神', kind: 'suffix', group: 'primary_spi',
    tags: ['universal', 'amulet', 'support'],
    stat: 'spirit', baseRange: [2, 8], nameWord: { suffix: '灵性' } },
  { id: 'suf_luck', name: '运气', kind: 'suffix', group: 'primary_luck',
    tags: ['universal', 'ring', 'amulet', 'support'],
    stat: 'luck', baseRange: [1, 6], nameWord: { suffix: '幸运' } },
  // 回复/资源
  { id: 'suf_res_regen', name: '资源回复', kind: 'suffix', group: 'resource_regen',
    tags: ['universal', 'ring', 'amulet', 'support'],
    stat: 'resourceRegen', baseRange: [1, 8], nameWord: { suffix: '涌泉' } },
  // 经济
  { id: 'suf_gold', name: '金币加成', kind: 'suffix', group: 'gold_bonus',
    tags: ['universal', 'ring', 'amulet', 'support'],
    stat: 'gold_bonus', baseRange: [0.05, 0.20], nameWord: { suffix: '贪婪' } },
  { id: 'suf_exp', name: '经验加成', kind: 'suffix', group: 'exp_bonus',
    tags: ['universal', 'ring', 'amulet', 'support'],
    stat: 'exp_bonus', baseRange: [0.05, 0.20], nameWord: { suffix: '悟性' } },
  // 冷却
  { id: 'suf_cd_reduce', name: '冷却缩减', kind: 'suffix', group: 'cooldown_reduction',
    tags: ['universal', 'ring', 'amulet', 'weapon', 'support'],
    stat: 'cooldownReduction', baseRange: [0.02, 0.08], nameWord: { suffix: '迅雷' } },
];

// ─── 传奇特殊词缀池 ─────────────────────────────────────
export interface SpecialAffixDef {
  id: string;
  name: string;
  description: string;
  stat: AffixStatKey;
  baseRange: [number, number];
  nameWord: string;
}

export const SPECIAL_AFFIX_DEFS: SpecialAffixDef[] = [
  { id: 'sp_might', name: '神力', description: '大幅提升额外伤害', stat: 'more_damage', baseRange: [0.15, 0.30], nameWord: '神力' },
  { id: 'sp_fury', name: '狂战', description: '大幅提升全域伤害', stat: 'inc_damage', baseRange: [0.20, 0.40], nameWord: '狂战' },
  { id: 'sp_guardian', name: '守护', description: '大幅提升伤害反弹', stat: 'damageReflect', baseRange: [0.10, 0.25], nameWord: '守护' },
  { id: 'sp_vampire', name: '血族', description: '大幅提升物理吸血', stat: 'physicalLeech', baseRange: [0.08, 0.15], nameWord: '血族' },
  { id: 'sp_swift', name: '疾风', description: '大幅提升速度', stat: 'speed', baseRange: [5, 15], nameWord: '疾风' },
  { id: 'sp_precision', name: '神射', description: '大幅提升暴击率', stat: 'critRate', baseRange: [0.10, 0.20], nameWord: '神射' },
  { id: 'sp_fortitude', name: '不屈', description: '大幅提升生命值', stat: 'maxHp', baseRange: [30, 80], nameWord: '不屈' },
  { id: 'sp_arcane', name: '秘法', description: '大幅提升魔法穿透', stat: 'magicPierce', baseRange: [0.15, 0.30], nameWord: '秘法' },
];

// ─── 工具函数 ──────────────────────────────────────────

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function roundValue(value: number, stat: AffixStatKey): number {
  if (isPercentStat(stat)) return Math.round(value * 1000) / 1000;
  return Math.round(value);
}

// ─── Tier 与等级缩放 ───────────────────────────────────

/** 按 AFFIX_TIERS 权重随机选择 tier */
export function rollTier(): number {
  const tiers = AFFIX_TIERS.map(t => t.tier);
  const weights = AFFIX_TIERS.map(t => t.weight);
  return weightedRandom(tiers, weights);
}

/** 计算等级缩放系数 */
export function calcLevelScale(ilvl: number): number {
  return 1 + (ilvl - 1) * LEVEL_SCALE_RATE;
}

/** 计算 tier 倍率 */
export function getTierMultiplier(tier: number): number {
  return AFFIX_TIERS.find(t => t.tier === tier)?.multiplier ?? 1.0;
}

/** roll 词缀数值：baseRange × tierMultiplier × levelScale */
export function rollAffixValue(
  baseRange: [number, number],
  tier: number,
  ilvl: number,
  stat: AffixStatKey,
): number {
  const tierMult = getTierMultiplier(tier);
  const levelScale = calcLevelScale(ilvl);
  const baseValue = randomRange(baseRange[0], baseRange[1]);
  return roundValue(baseValue * tierMult * levelScale, stat);
}

// ─── Tag 推导 ──────────────────────────────────────────

/** 根据基底、槽位、职业推导可用词缀 Tag 集合 */
export function deriveTags(base: BaseType, heroClass: HeroClass): AffixTag[] {
  const tags: AffixTag[] = ['universal'];
  const slot = base.slot;

  // 部位 tag
  if (slot === EquipSlot.Weapon) tags.push('weapon');
  else if (slot === EquipSlot.OffHand) tags.push('offhand');
  else if (slot === EquipSlot.Armor) tags.push('armor');
  else if (slot === EquipSlot.Helmet) tags.push('helmet');
  else if (slot === EquipSlot.Boots) tags.push('boots');
  else if (slot === EquipSlot.Ring1 || slot === EquipSlot.Ring2) tags.push('ring');
  else if (slot === EquipSlot.Amulet) tags.push('amulet');

  // 方向 tag
  if (slot === EquipSlot.Weapon) tags.push('offensive');
  else if (slot === EquipSlot.OffHand) {
    if (base.itemClass === 'shield') tags.push('defensive');
    else tags.push('offensive');
  } else if (slot === EquipSlot.Armor || slot === EquipSlot.Helmet || slot === EquipSlot.Boots) {
    tags.push('defensive');
  } else {
    tags.push('support');
  }

  // 职业 tag
  if (heroClass === HeroClass.Warrior) tags.push('warrior');
  else if (heroClass === HeroClass.Mage) tags.push('mage');
  else if (heroClass === HeroClass.Ranger) tags.push('ranger');

  // 物品类别 tag
  if (base.itemClass.includes('sword') || base.itemClass.includes('axe')) tags.push('physical');
  if (base.itemClass.includes('staff') || base.itemClass.includes('focus')) tags.push('magic');
  if (base.itemClass.includes('bow')) tags.push('ranged');

  return tags;
}

// ─── 词缀生成 ──────────────────────────────────────────

/** 按 tag 过滤候选词缀定义 */
function filterAffixDefs(defs: AffixDef[], tags: AffixTag[]): AffixDef[] {
  return defs.filter(def => def.tags.some(t => tags.includes(t)));
}

/** 生成一个前缀词缀 */
export function rollPrefix(tags: AffixTag[], ilvl: number, usedGroups: Set<string>): RolledMod | null {
  const candidates = filterAffixDefs(PREFIX_DEFS, tags).filter(d => !usedGroups.has(d.group));
  if (candidates.length === 0) return null;
  const def = candidates[Math.floor(Math.random() * candidates.length)];
  const tier = rollTier();
  const value = rollAffixValue(def.baseRange, tier, ilvl, def.stat);
  usedGroups.add(def.group);
  return {
    defId: def.id,
    name: def.name,
    stat: def.stat,
    value,
    tier,
    kind: 'prefix',
  };
}

/** 生成一个后缀词缀 */
export function rollSuffix(tags: AffixTag[], ilvl: number, usedGroups: Set<string>): RolledMod | null {
  const candidates = filterAffixDefs(SUFFIX_DEFS, tags).filter(d => !usedGroups.has(d.group));
  if (candidates.length === 0) return null;
  const def = candidates[Math.floor(Math.random() * candidates.length)];
  const tier = rollTier();
  const value = rollAffixValue(def.baseRange, tier, ilvl, def.stat);
  usedGroups.add(def.group);
  return {
    defId: def.id,
    name: def.name,
    stat: def.stat,
    value,
    tier,
    kind: 'suffix',
  };
}

/** 生成隐式词缀（从基底定义，走 levelScale 但不走 tier） */
export function rollImplicit(base: BaseType, ilvl: number): RolledMod | undefined {
  if (!base.implicit) return undefined;
  const levelScale = calcLevelScale(ilvl);
  const raw = randomRange(base.implicit.baseRange[0], base.implicit.baseRange[1]);
  const value = roundValue(raw * levelScale, base.implicit.stat);
  return {
    defId: `implicit_${base.id}`,
    name: base.implicit.name,
    stat: base.implicit.stat,
    value,
    tier: 0,
    kind: 'prefix', // 隐式词缀不区分前后缀，用 prefix 占位
  };
}

/** 生成传奇特殊词缀 */
export function rollSpecialAffix(ilvl: number): RolledMod {
  const def = SPECIAL_AFFIX_DEFS[Math.floor(Math.random() * SPECIAL_AFFIX_DEFS.length)];
  const tier = rollTier();
  const value = rollAffixValue(def.baseRange, tier, ilvl, def.stat);
  return {
    defId: def.id,
    name: def.name,
    stat: def.stat,
    value,
    tier,
    kind: 'prefix', // 特殊词缀不区分前后缀
  };
}

// ─── 稀有度判定 ─────────────────────────────────────────

export function rollRarity(dropRateBonus: number = 0): Rarity {
  const weights = { ...RARITY_WEIGHTS };
  weights[Rarity.Rare] *= 1 + dropRateBonus;
  weights[Rarity.Epic] *= 1 + dropRateBonus;
  weights[Rarity.Legendary] *= 1 + dropRateBonus;

  const entries = Object.entries(weights) as [Rarity, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return Rarity.Normal;
}

// ─── 装备生成 ──────────────────────────────────────────

/**
 * 生成一件随机装备（POE2 风格）
 * @param ilvl 装备等级（= 怪物等级）
 * @param heroClass 英雄职业，用于过滤基底和词缀
 * @param opts 可选参数
 */
export function generateEquipment(
  ilvl: number,
  heroClass: HeroClass,
  opts?: {
    forcedSlot?: EquipSlot;
    dropRateBonus?: number;
    forceRarity?: Rarity;
  },
): Equipment {
  const rarity = opts?.forceRarity ?? rollRarity(opts?.dropRateBonus ?? 0);

  // 选槽位
  const slot = opts?.forcedSlot ?? randomSlot(heroClass);

  // 选基底（按职业倾向加权）
  const base = pickBaseType(slot, ilvl, heroClass);

  // 推导词缀 tag
  const tags = deriveTags(base, heroClass);
  const usedGroups = new Set<string>();

  // 生成隐式词缀
  const implicit = rollImplicit(base, ilvl);

  // 按稀有度生成前缀/后缀
  const slots = RARITY_AFFIX_SLOTS[rarity];
  const prefixes: RolledMod[] = [];
  const suffixes: RolledMod[] = [];

  for (let i = 0; i < slots.prefix; i++) {
    const mod = rollPrefix(tags, ilvl, usedGroups);
    if (mod) prefixes.push(mod);
  }
  for (let i = 0; i < slots.suffix; i++) {
    const mod = rollSuffix(tags, ilvl, usedGroups);
    if (mod) suffixes.push(mod);
  }

  // 传奇特殊词缀
  let specialAffix: RolledMod | undefined;
  if (slots.special > 0) {
    specialAffix = rollSpecialAffix(ilvl);
  }

  // 生成名称
  const name = generateItemName(base, rarity, prefixes, suffixes);

  return {
    id: crypto.randomUUID(),
    baseTypeId: base.id,
    name,
    slot,
    rarity,
    itemLevel: ilvl,
    implicit,
    prefixes,
    suffixes,
    specialAffix,
    requiredLevel: Math.max(1, ilvl - 2),
    icon: base.iconClass,
  };
}

// ─── 装备命名（POE2 风格）──────────────────────────────

export function generateItemName(
  base: BaseType,
  rarity: Rarity,
  prefixes: RolledMod[],
  suffixes: RolledMod[],
): string {
  switch (rarity) {
    case Rarity.Normal:
      return base.name;

    case Rarity.Magic: {
      // [前缀词] + 基底名 + [·后缀词]
      const preDef = prefixes[0] ? PREFIX_DEFS.find(d => d.id === prefixes[0].defId) : undefined;
      const sufDef = suffixes[0] ? SUFFIX_DEFS.find(d => d.id === suffixes[0].defId) : undefined;
      const preWord = preDef?.nameWord?.prefix;
      const sufWord = sufDef?.nameWord?.suffix;
      let name = base.name;
      if (preWord) name = `${preWord}的${name}`;
      if (sufWord) name = `${name}·${sufWord}`;
      return name;
    }

    case Rarity.Rare:
    case Rarity.Epic:
    case Rarity.Legendary:
    case Rarity.Apex: {
      // 从名字池随机生成两段式名字
      const pre = RARE_NAME_POOL.prefix[Math.floor(Math.random() * RARE_NAME_POOL.prefix.length)];
      const suf = RARE_NAME_POOL.suffix[Math.floor(Math.random() * RARE_NAME_POOL.suffix.length)];
      return `${pre}${suf}`;
    }

    default:
      return base.name;
  }
}

// ─── 内部工具 ──────────────────────────────────────────

/** 随机选槽位（按职业倾向加权） */
function randomSlot(heroClass: HeroClass): EquipSlot {
  const slotWeights: Record<EquipSlot, number> = {
    [EquipSlot.Weapon]: 3,
    [EquipSlot.OffHand]: 2,
    [EquipSlot.Armor]: 3,
    [EquipSlot.Helmet]: 2,
    [EquipSlot.Boots]: 2,
    [EquipSlot.Ring1]: 2,
    [EquipSlot.Ring2]: 2,
    [EquipSlot.Amulet]: 1,
  };
  const slots = Object.keys(slotWeights) as EquipSlot[];
  const weights = slots.map(s => slotWeights[s]);
  return weightedRandom(slots, weights);
}

/** 选基底（按 classRestriction 匹配 heroClass 加权） */
function pickBaseType(slot: EquipSlot, ilvl: number, heroClass: HeroClass): BaseType {
  // Ring1 和 Ring2 共用同一池
  const effectiveSlot = slot === EquipSlot.Ring2 ? EquipSlot.Ring1 : slot;

  let candidates = BASE_TYPES.filter(b => b.slot === effectiveSlot && b.minLevel <= ilvl);
  if (candidates.length === 0) {
    // fallback：取该 slot 最低 minLevel 的
    candidates = BASE_TYPES.filter(b => b.slot === effectiveSlot);
  }
  if (candidates.length === 0) {
    // ultimate fallback
    return BASE_TYPES[0];
  }

  // 按 classRestriction 加权：匹配 heroClass 的基底权重 ×3
  const weights = candidates.map(b =>
    b.classRestriction.includes(heroClass) ? 3 : 1
  );

  return weightedRandom(candidates, weights);
}
