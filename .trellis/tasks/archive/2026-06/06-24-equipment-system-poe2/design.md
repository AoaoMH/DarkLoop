# 技术设计：POE2 风格装备系统

## 架构概览

```
BaseType（基底定义，静态数据）
  ├── implicit: ImplicitMod        ← 隐式词缀（恒定）
  ├── baseStats: Partial<PrimaryStats>
  ├── slot: EquipSlot
  ├── itemClass: string             ← 物品类别（one_hand_sword / shield / plate ...）
  ├── twoHanded: boolean
  ├── classRestriction: HeroClass[]
  └── minLevel: number

AffixDef（词缀定义，静态数据）
  ├── kind: 'prefix' | 'suffix'
  ├── group: string                 ← mod group，同组不可共存
  ├── tags: AffixTag[]              ← 过滤条件
  ├── stat: AffixStatKey
  ├── baseRange: [number, number]   ← T5（基准）的 base 值范围
  └── nameWord: { prefix?: string; suffix?: string }  ← 命名用词

Equipment（装备实例，存档持久化）
  ├── id, name, slot, rarity, icon, requiredLevel
  ├── itemLevel: number             ← 新增：装备等级（= 掉落时怪物等级）
  ├── baseTypeId: string            ← 引用 BaseType
  ├── implicit: RolledMod          ← 从基底隐式词缀 roll 出的实例
  ├── prefixes: RolledMod[]        ← 前缀实例
  ├── suffixes: RolledMod[]        ← 后缀实例
  ├── specialAffix?: RolledMod     ← Legendary 特殊词缀
  ├── enchantments?: RolledMod[]   ← 预留：附魔槽
  └── corrupted?: boolean          ← 预留：腐蚀标记
```

## 数据契约

### 1. types/index.ts 改动

```ts
// ─── 装备槽位（8 槽）───
export enum EquipSlot {
  Weapon = 'weapon',
  OffHand = 'offhand',
  Armor = 'armor',
  Helmet = 'helmet',
  Boots = 'boots',
  Ring1 = 'ring1',
  Ring2 = 'ring2',
  Amulet = 'amulet',
}

// ─── 稀有度（6 档）───
export enum Rarity {
  Normal = 'normal',
  Magic = 'magic',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
  Apex = 'apex',
}

// ─── 词缀类型 ───
export type AffixKind = 'prefix' | 'suffix';

// 词缀 Tag：限制词缀可出现的职业/类型/部位
export type AffixTag =
  | 'universal' | 'physical' | 'magic' | 'ranged'
  | 'warrior' | 'mage' | 'ranger'
  | 'weapon' | 'offhand' | 'armor' | 'helmet' | 'boots' | 'ring' | 'amulet'
  | 'offensive' | 'defensive' | 'support'
  | 'fire' | 'ice' | 'lightning' | 'poison' | 'shadow' | 'holy';

// 词缀属性键（保留现有）
export type AffixStatKey =
  | keyof PrimaryStats
  | keyof DerivedStats
  | 'inc_damage' | 'more_damage'
  | 'elite_damage' | 'boss_damage'
  | 'bleed_chance' | 'extra_element'
  | 'gold_bonus' | 'exp_bonus' | 'luck_bonus';

// 词缀定义（静态数据）
export interface AffixDef {
  id: string;
  name: string;                     // 展示名（如「物理攻击」）
  kind: AffixKind;                  // prefix | suffix
  group: string;                    // mod group，同组不可共存
  tags: AffixTag[];                 // 过滤条件
  stat: AffixStatKey;
  baseRange: [number, number];      // T5 基准值范围
  nameWord?: { prefix?: string; suffix?: string }; // 命名用词
}

// 隐式词缀定义（基底自带）
export interface ImplicitModDef {
  stat: AffixStatKey;
  baseRange: [number, number];      // 固定值范围（不走 tier，但走 levelScale）
  name: string;
}

// roll 出的词缀实例
export interface RolledMod {
  defId: string;                    // 引用 AffixDef.id（隐式词缀用 baseTypeId）
  name: string;
  stat: AffixStatKey;
  value: number;
  tier: number;                     // 1-8（隐式词缀 tier=0 表示不走 tier）
  kind: AffixKind;
}

// 基底定义（静态数据）
export interface BaseType {
  id: string;
  name: string;                     // 基底名（如「铁剑」）
  typeName: string;                 // 物品类别名（如「单手剑」）
  slot: EquipSlot;
  itemClass: string;                // 物品类别 ID
  minLevel: number;
  baseStats: Partial<PrimaryStats>;
  implicit?: ImplicitModDef;
  twoHanded: boolean;
  classRestriction: HeroClass[];    // 可使用的职业
  iconClass: string;
}

// 装备实例（存档持久化）
export interface Equipment {
  id: EntityId;
  baseTypeId: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  itemLevel: number;
  implicit?: RolledMod;
  prefixes: RolledMod[];
  suffixes: RolledMod[];
  specialAffix?: RolledMod;
  enchantments?: RolledMod[];       // 预留
  corrupted?: boolean;              // 预留
  requiredLevel: number;
  icon: string;
}
```

### 2. constants/equipment.ts 改动

```ts
// Tier 配置（8 档，T1=最好）
export const AFFIX_TIERS = [
  { tier: 1, multiplier: 2.0, weight: 2 },
  { tier: 2, multiplier: 1.7, weight: 5 },
  { tier: 3, multiplier: 1.4, weight: 8 },
  { tier: 4, multiplier: 1.2, weight: 12 },
  { tier: 5, multiplier: 1.0, weight: 15 },
  { tier: 6, multiplier: 0.8, weight: 18 },
  { tier: 7, multiplier: 0.6, weight: 20 },
  { tier: 8, multiplier: 0.4, weight: 20 },
];

// 稀有度权重（Apex 不产出）
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.Normal]: 45,
  [Rarity.Magic]: 30,
  [Rarity.Rare]: 18,
  [Rarity.Epic]: 5,
  [Rarity.Legendary]: 2,
  [Rarity.Apex]: 0,
};

// 稀有度 → 前缀/后缀位数
export const RARITY_AFFIX_SLOTS: Record<Rarity, { prefix: number; suffix: number; special: number }> = {
  [Rarity.Normal]: { prefix: 0, suffix: 0, special: 0 },
  [Rarity.Magic]: { prefix: 1, suffix: 1, special: 0 },
  [Rarity.Rare]: { prefix: 2, suffix: 2, special: 0 },
  [Rarity.Epic]: { prefix: 3, suffix: 3, special: 0 },
  [Rarity.Legendary]: { prefix: 3, suffix: 3, special: 1 },
  [Rarity.Apex]: { prefix: 3, suffix: 3, special: 1 },
};

// 等级缩放系数
export const LEVEL_SCALE_RATE = 0.1; // levelScale = 1 + (ilvl - 1) * 0.1

// 基底池（每部位 ≥3，可扩展）
export const BASE_TYPES: BaseType[] = [ /* ~25+ 条 */ ];

// Rare+ 名字池
export const RARE_NAME_POOL = {
  prefix: ['毁灭', '虚空', '暗影', '血月', '霜寂', '雷怒', '深渊', '苍穹', ...],
  suffix: ['之刃', '之息', '之怒', '之誓', '之痕', '之翼', '之冠', '之痕', ...],
};
```

### 3. logic/loot.ts 改动

```ts
// 词缀池（prefix + suffix 分离，含 group）
export const AFFIX_DEFS: AffixDef[] = [ /* 40+ 条 */ ];

// 核心函数签名
export function rollTier(): number;                                    // 按 AFFIX_TIERS 权重随机
export function calcLevelScale(ilvl: number): number;                  // 1 + (ilvl-1)*0.1
export function rollAffixValue(def: AffixDef, tier: number, ilvl: number): number;
export function rollPrefix(tags: AffixTag[], ilvl: number, usedGroups: Set<string>): RolledMod;
export function rollSuffix(tags: AffixTag[], ilvl: number, usedGroups: Set<string>): RolledMod;
export function rollImplicit(base: BaseType, ilvl: number): RolledMod | undefined;
export function generateEquipment(ilvl: number, heroClass: HeroClass, opts?: {
  forcedSlot?: EquipSlot;
  dropRateBonus?: number;
  forceRarity?: Rarity;
}): Equipment;
export function generateItemName(base: BaseType, rarity: Rarity, prefixes: RolledMod[], suffixes: RolledMod[]): string;
```

### 4. logic/combat.ts 改动

```ts
// 属性聚合需适配新结构
export function calcCombinedPrimary(hero: Hero): PrimaryStats {
  // 遍历 equipment → baseStats + implicit + prefixes + suffixes + specialAffix
  //   其中 primary stat 类型的词缀累加到 combined
}

export function calcDerivedStats(base: PrimaryStats, equipment: Equipment[], level: number): DerivedStats {
  // 同上，derived stat 类型的词缀累加到 derived
}

// getAffixCount 废弃，改用 RARITY_AFFIX_SLOTS
```

### 5. 客户端改动

**EquipTooltip.tsx**：
- 分区显示：隐式词缀（灰）→ 前缀（蓝）→ 后缀（蓝）→ 特殊词缀（橙/金高亮）
- 物品类型行显示 `typeName`（如「单手剑」）
- 名称行显示生成的 `name`

**CharacterPanel.tsx**：
- 装备槽从 6 个扩展到 8 个（新增 OffHand + Ring2）
- 双手武器装备时 OffHand 槽显示锁定状态

**gameStore.ts**：
- SAVE_VERSION = 4
- 默认测试数据适配新 Equipment 结构

**TurnBattleUI.tsx**：
- 掉落展示适配新结构

## 掉落倾向算法

```
generateEquipment(ilvl, heroClass):
  1. rollRarity(dropRateBonus)  → Rarity
  2. 选 slot：
     - forcedSlot 或按 slot 权重随机
     - slot 权重受 heroClass 影响（战士偏 weapon/armor）
  3. 选基底：
     - filter BASE_TYPES by slot + minLevel <= ilvl
     - 按 classRestriction 加权（匹配 heroClass 的基底权重 ×3）
     - 随机选一个
  4. rollImplicit(base, ilvl)
  5. 按 RARITY_AFFIX_SLOTS[rarity] 生成 prefix/suffix：
     - deriveTags(base, slot, heroClass) → AffixTag[]
     - rollPrefix(tags, ilvl, usedGroups)
     - rollSuffix(tags, ilvl, usedGroups)
     - 同 group 不可重复
  6. if Legendary: rollSpecialAffix()
  7. generateItemName(...)
  8. return Equipment
```

## Tag 推导规则

```
deriveTags(base, slot, heroClass) → AffixTag[]:
  tags = ['universal']
  
  // 部位 tag
  tags.push(slot对应的tag: 'weapon' | 'offhand' | 'armor' | 'helmet' | 'boots' | 'ring' | 'amulet')
  
  // 方向 tag（武器→offensive，防具→defensive，饰品→support）
  if (slot is Weapon or OffHand-shield): tags.push('offensive')
  if (slot is Armor/Helmet/Boots): tags.push('defensive')
  if (slot is Ring/Amulet): tags.push('support')
  
  // 职业 tag
  tags.push(heroClass对应的tag: 'warrior' | 'mage' | 'ranger')
  
  // 物品类别 tag
  if (base.itemClass starts with 'sword'/'axe'): tags.push('physical')
  if (base.itemClass starts with 'staff'/'focus'): tags.push('magic')
  if (base.itemClass starts with 'bow'/'crossbow'): tags.push('ranged')
```

## 词缀池设计原则

### Prefix（前缀，偏攻击）
- 物理攻击、远程攻击、魔法攻击
- 暴击伤害、全域伤害(inc_damage)、额外伤害(more_damage)
- 力量、敏捷、智力（主属性）
- 穿透（护甲穿透、魔法穿透）
- 吸血（物理吸血、魔法吸血）
- 精英伤害、首领伤害

### Suffix（后缀，偏防御/辅助）
- 护甲、魔法抗性
- 暴击率、命中、闪避
- 格挡率、格挡值
- 生命回复、资源回复
- 速度、异常抗性、伤害反弹
- 运气、金币加成、经验加成
- 体质、精神（副属性）

### 特殊词缀（Legendary only）
- +1 技能等级
- 给技能添加附加效果（如 bleed/stun/burn）
- 技能伤害倍率提升
- 特殊被动触发（如受击反弹）

## 兼容性与迁移

- 旧 `Affix` 类型 → 废弃，用 `RolledMod` 替代
- 旧 `AffixDef` → 重构（加 kind/group/nameWord，valueRange 改 baseRange）
- 旧 `EQUIP_TEMPLATES` → 废弃，用 `BASE_TYPES` 替代
- 旧 `getAffixCount()` → 废弃，用 `RARITY_AFFIX_SLOTS` 替代
- 旧 `Equipment.affixes` → 废弃，拆分为 `implicit/prefixes/suffixes/specialAffix`
- 旧 `Equipment.templateId` → 改为 `baseTypeId`
- 新增 `Equipment.itemLevel` 字段

## 扩展性设计

- **新增基底**：只需在 `BASE_TYPES` 数组添加条目
- **新增词缀**：只需在 `AFFIX_DEFS` 添加条目，指定 kind/group/tags
- **新增稀有度**：扩展 Rarity + RARITY_WEIGHTS + RARITY_AFFIX_SLOTS
- **新增 tier**：扩展 AFFIX_TIERS 数组
- **附魔系统**：Equipment.enchantments 已预留，后续实现 enchantment 定义和 roll 逻辑
- **腐蚀系统**：Equipment.corrupted 已预留，后续实现 corruption 池
- **打造系统**：基于现有 prefix/suffix 结构，后续添加 currency 操作函数
