/**
 * 装备/掉落生成器 - 客户端/服务端共享
 * 词缀池 + Tag 系统：防止出其他职业的装备词条
 */

import type { Equipment, Affix, AffixDef, AffixTag, AffixStatKey } from '../types';
import { Rarity, EquipSlot } from '../types';
import { getAffixCount } from './combat';
import { AFFIX_TIERS, RARITY_WEIGHTS, EQUIP_TEMPLATES } from '../constants/equipment';

// ─── 词缀品阶缩放（tier 越高数值越大）─────────────────────
const AFFIX_TIER_SCALE = [1, 1.8, 3, 5, 8];

// ─── 默认 tier 权重（按 AFFIX_TIERS 5 档）──────────────────
const DEFAULT_TIER_WEIGHTS = [0.5, 0.3, 0.15, 0.04, 0.01];

// ─── 词缀池定义 ─────────────────────────────────────────
// tags 决定可出现范围；valueRange 为 tier1 基础值范围，按 tier 缩放

export const AFFIX_DEFS: AffixDef[] = [
  // ── 基础属性（6 维）──
  { id: 'affix_str',  name: '力量',  tags: ['universal', 'warrior'], stat: 'strength',     valueRange: [2, 8],   tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_agi',  name: '敏捷',  tags: ['universal', 'ranger'],  stat: 'agility',      valueRange: [2, 8],   tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_int',  name: '智力',  tags: ['universal', 'mage'],    stat: 'intelligence', valueRange: [2, 8],   tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_vit',  name: '体质',  tags: ['universal'],            stat: 'vitality',     valueRange: [2, 8],   tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_spi',  name: '精神',  tags: ['universal'],            stat: 'spirit',       valueRange: [2, 8],   tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_luck', name: '运气',  tags: ['universal'],            stat: 'luck',         valueRange: [1, 6],   tierWeights: DEFAULT_TIER_WEIGHTS },

  // ── 攻击属性 ──
  { id: 'affix_phys_atk',   name: '物理攻击',   tags: ['physical', 'warrior'],                stat: 'physicalAttack', valueRange: [3, 15],  tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_ranged_atk', name: '远程攻击',   tags: ['ranged', 'ranger'],                   stat: 'rangedAttack',   valueRange: [3, 15],  tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_magic_atk',  name: '魔法攻击',   tags: ['magic', 'mage'],                      stat: 'magicAttack',    valueRange: [3, 15],  tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_crit_rate',  name: '暴击率',     tags: ['universal'],                          stat: 'critRate',       valueRange: [0.01, 0.05], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_crit_dmg',   name: '暴击伤害',   tags: ['universal'],                          stat: 'critDamage',     valueRange: [0.1, 0.5], tierWeights: DEFAULT_TIER_WEIGHTS },

  // ── 防御属性 ──
  { id: 'affix_armor',        name: '护甲',     tags: ['universal'],            stat: 'armor',        valueRange: [3, 15],     tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_magic_resist', name: '魔法抗性', tags: ['universal'],            stat: 'magicResist',  valueRange: [3, 15],     tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_block_rate',   name: '格挡率',   tags: ['physical', 'warrior'],  stat: 'blockRate',   valueRange: [0.02, 0.08], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_block_value',  name: '格挡值',   tags: ['physical', 'warrior'],  stat: 'blockValue',  valueRange: [2, 10],     tierWeights: DEFAULT_TIER_WEIGHTS },

  // ── 穿透 ──
  { id: 'affix_armor_pierce', name: '护甲穿透', tags: ['physical'], stat: 'armorPierce',  valueRange: [2, 12], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_magic_pierce', name: '魔法穿透', tags: ['magic'],    stat: 'magicPierce',  valueRange: [2, 12], tierWeights: DEFAULT_TIER_WEIGHTS },

  // ── 吸血 ──
  { id: 'affix_phys_leech',  name: '物理吸血',  tags: ['physical'], stat: 'physicalLeech', valueRange: [0.01, 0.05], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_magic_leech', name: '魔法吸血',  tags: ['magic'],    stat: 'magicLeech',    valueRange: [0.01, 0.05], tierWeights: DEFAULT_TIER_WEIGHTS },

  // ── 回复 ──
  { id: 'affix_hp_regen',  name: '生命回复',   tags: ['universal'], stat: 'hpRegen',      valueRange: [1, 8], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_res_regen', name: '资源回复',   tags: ['universal'], stat: 'resourceRegen',valueRange: [1, 8], tierWeights: DEFAULT_TIER_WEIGHTS },

  // ── 通用战斗 ──
  { id: 'affix_speed',         name: '速度',       tags: ['universal'], stat: 'speed',          valueRange: [1, 8],        tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_status_resist', name: '异常抗性',   tags: ['universal'], stat: 'statusResist',   valueRange: [0.01, 0.05], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_damage_reflect',name: '伤害反弹',   tags: ['universal'], stat: 'damageReflect',  valueRange: [0.01, 0.05], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_accuracy',      name: '命中',       tags: ['universal'], stat: 'accuracy',       valueRange: [0.01, 0.05], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_evade',         name: '闪避',       tags: ['universal'], stat: 'evade',          valueRange: [0.01, 0.05], tierWeights: DEFAULT_TIER_WEIGHTS },

  // ── 特殊词缀（暗黑风 inc/more/精英/Boss）──
  { id: 'affix_inc_damage',   name: '全域伤害',   tags: ['universal'], stat: 'inc_damage',     valueRange: [0.05, 0.15], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_more_damage',  name: '额外伤害',   tags: ['universal'], stat: 'more_damage',    valueRange: [0.05, 0.15], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_elite_damage', name: '精英伤害',   tags: ['universal'], stat: 'elite_damage',   valueRange: [0.05, 0.20], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_boss_damage',  name: '首领伤害',   tags: ['universal'], stat: 'boss_damage',    valueRange: [0.05, 0.20], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_bleed_chance', name: '流血概率',   tags: ['physical'],  stat: 'bleed_chance',   valueRange: [0.05, 0.15], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_gold_bonus',   name: '金币加成',   tags: ['universal'], stat: 'gold_bonus',     valueRange: [0.05, 0.20], tierWeights: DEFAULT_TIER_WEIGHTS },
  { id: 'affix_exp_bonus',    name: '经验加成',   tags: ['universal'], stat: 'exp_bonus',      valueRange: [0.05, 0.20], tierWeights: DEFAULT_TIER_WEIGHTS },
];

// ─── 装备 Tag 推导 ────────────────────────────────────────

/** 根据装备模板推导该装备可用的词缀 Tag 集合 */
export function deriveEquipTags(templateId: string, slot: EquipSlot, element?: AffixTag): AffixTag[] {
  const tags: AffixTag[] = ['universal'];

  // 武器按模板决定物理/魔法/远程 + 职业倾向
  if (slot === EquipSlot.Weapon) {
    if (templateId.startsWith('sword')) tags.push('physical', 'warrior');
    else if (templateId.startsWith('staff')) tags.push('magic', 'mage');
    else if (templateId.startsWith('bow')) tags.push('ranged', 'ranger');
  }

  // 元素伤害标记
  if (element) tags.push(element);

  return tags;
}

// ─── 词缀生成 ─────────────────────────────────────────

/** 按 tag 过滤候选词缀定义 */
function filterAffixDefs(equipTags: AffixTag[]): AffixDef[] {
  return AFFIX_DEFS.filter(def => def.tags.some(t => equipTags.includes(t)));
}

/** 生成一个随机词缀（按装备 tag 过滤） */
export function rollAffix(equipTags: AffixTag[], itemLevel: number): Affix {
  const candidates = filterAffixDefs(equipTags);
  const pool = candidates.length > 0 ? candidates : AFFIX_DEFS;
  const def = pool[Math.floor(Math.random() * pool.length)];

  const tier = rollTier(itemLevel, def.tierWeights);
  const scale = AFFIX_TIER_SCALE[tier - 1] ?? 1;
  const [vMin, vMax] = def.valueRange;
  const baseValue = randomRange(vMin, vMax);
  const value = roundAffixValue(baseValue * scale, def.stat);

  return {
    defId: def.id,
    name: `${def.name} +${formatAffixValue(value, def.stat)}`,
    stat: def.stat,
    value,
    tier,
  };
}

/** 根据等级和词缀品阶权重决定 tier */
function rollTier(itemLevel: number, tierWeights: number[]): number {
  const maxTier = Math.min(Math.floor(itemLevel / 10) + 1, AFFIX_TIERS.length);
  const weights = tierWeights.slice(0, maxTier);
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i + 1;
  }
  return 1;
}

/** 百分比属性保留小数，整数属性取整 */
function roundAffixValue(value: number, stat: AffixStatKey): number {
  const percentStats: AffixStatKey[] = [
    'critRate', 'critDamage', 'evade', 'blockRate', 'blockPercent',
    'armorPierce', 'magicPierce', 'physicalLeech', 'magicLeech',
    'cooldownReduction', 'statusResist', 'damageReflect', 'accuracy',
    'inc_damage', 'more_damage', 'elite_damage', 'boss_damage',
    'bleed_chance', 'gold_bonus', 'exp_bonus', 'luck_bonus',
  ];
  if (percentStats.includes(stat)) return Math.round(value * 1000) / 1000;
  return Math.round(value);
}

/** 格式化词缀数值用于名称显示 */
function formatAffixValue(value: number, stat: AffixStatKey): number {
  const percentStats: AffixStatKey[] = [
    'critRate', 'critDamage', 'evade', 'blockRate', 'blockPercent',
    'armorPierce', 'magicPierce', 'physicalLeech', 'magicLeech',
    'cooldownReduction', 'statusResist', 'damageReflect', 'accuracy',
    'inc_damage', 'more_damage', 'elite_damage', 'boss_damage',
    'bleed_chance', 'gold_bonus', 'exp_bonus', 'luck_bonus',
  ];
  if (percentStats.includes(stat)) return Math.round(value * 1000) / 10;
  return value;
}

// ─── 稀有度判定 ─────────────────────────────────────────

/** 根据怪物等级和加成判定掉落稀有度 */
export function rollRarity(dropRateBonus: number = 0): Rarity {
  const weights = { ...RARITY_WEIGHTS };

  // 加成提升稀有以上品质的权重
  weights[Rarity.Rare] *= 1 + dropRateBonus;
  weights[Rarity.Epic] *= 1 + dropRateBonus;
  weights[Rarity.Legendary] *= 1 + dropRateBonus;

  return weightedRandom(weights);
}

// ─── 装备生成 ─────────────────────────────────────────

/**
 * 生成一件随机装备
 * @param itemLevel 装备等级（通常等于怪物等级）
 * @param dropRateBonus 稀有度加成（运气影响）
 * @param forcedSlot 指定部位，不传则随机
 * @param heroTags 英雄职业 tag，用于过滤词缀（默认战士）
 */
export function generateEquipment(
  itemLevel: number,
  dropRateBonus: number = 0,
  forcedSlot?: EquipSlot,
  heroTags: AffixTag[] = ['universal', 'warrior'],
  forceRarity?: Rarity
): Equipment {
  const rarity = forceRarity ?? rollRarity(dropRateBonus);
  const slot = forcedSlot ?? randomSlot();
  const template = pickTemplate(slot, itemLevel);
  const equipTags = deriveEquipTags(template.id, slot);
  // 装备 tag 与英雄 tag 取并集（英雄职业词缀也能出）
  const effectiveTags = Array.from(new Set([...equipTags, ...heroTags]));

  const affixCount = getAffixCount(rarity);
  const affixes: Affix[] = [];
  const usedDefIds = new Set<string>();
  for (let i = 0; i < affixCount; i++) {
    // 避免同一词缀定义重复出现
    let affix = rollAffix(effectiveTags, itemLevel);
    let attempts = 0;
    while (usedDefIds.has(affix.defId) && attempts < 5) {
      affix = rollAffix(effectiveTags, itemLevel);
      attempts++;
    }
    usedDefIds.add(affix.defId);
    affixes.push(affix);
  }

  const name = generateItemName(template.name, rarity, affixes);

  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    name,
    slot,
    rarity,
    baseStats: template.baseStats,
    affixes,
    requiredLevel: Math.max(1, itemLevel - 2),
    icon: template.iconClass,
  };
}

// ─── 内部工具 ─────────────────────────────────────────

function randomSlot(): EquipSlot {
  const slots = Object.values(EquipSlot);
  return slots[Math.floor(Math.random() * slots.length)];
}

function pickTemplate(slot: EquipSlot, level: number) {
  const templates = EQUIP_TEMPLATES.filter(t => t.slot === slot && t.minLevel <= level);
  return templates[Math.floor(Math.random() * templates.length)] ?? EQUIP_TEMPLATES[0];
}

function generateItemName(baseName: string, rarity: Rarity, affixes: Affix[]): string {
  const prefixes: Record<Rarity, string> = {
    [Rarity.Common]: '',
    [Rarity.Fine]: '精良的',
    [Rarity.Rare]: '稀有的',
    [Rarity.Epic]: '史诗的',
    [Rarity.Legendary]: '传说之',
    [Rarity.Mythic]: '神话之',
    [Rarity.Apex]: '至臻·',
  };
  const prefix = prefixes[rarity];
  const suffix = affixes.length > 0 ? affixes[0].name.split('+')[0].trim() : '';
  return `${prefix}${baseName}${suffix ? '·' + suffix : ''}`.trim();
}

function weightedRandom<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
