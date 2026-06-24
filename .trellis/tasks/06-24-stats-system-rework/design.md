# 属性系统重构 - 技术设计

## 架构总览

```
PrimaryStats (基础6维, 存档)
    ↓ calcDerivedStats()
DerivedStats (二级~22项, 运行时计算, 不存档)
    ↓ calcDamage() / combat loop
DamageInstance (伤害实例, 含元素/类别)
    ↓ applyBuff/Effect
TurnState (战斗状态, 含buff/debuff)
```

**核心原则**：基础属性存档，二级属性运行时计算。新增属性类型只需扩展类型+公式常量+计算函数，不改战斗循环核心。

## 数据契约

### 1. types/index.ts

```ts
// 基础属性 6 维（替代旧 HeroStats）
interface PrimaryStats {
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  spirit: number;
  luck: number;
}

// HeroStats 别名保留（向后兼容，= PrimaryStats）
type HeroStats = PrimaryStats;

// 二级属性（运行时计算）
interface DerivedStats {
  maxHp: number;
  maxResource: number;
  physicalAttack: number;
  rangedAttack: number;
  magicAttack: number;
  armor: number;
  magicResist: number;
  critRate: number;
  critDamage: number;
  accuracy: number;
  evade: number;
  blockRate: number;
  blockValue: number;
  blockPercent: number;
  armorPierce: number;
  magicPierce: number;
  physicalLeech: number;
  magicLeech: number;
  hpRegen: number;
  resourceRegen: number;
  cooldownReduction: number;
  statusResist: number;
  damageReflect: number;
  speed: number;
}

// 伤害类型
type DamageCategory = 'physical' | 'magic';
type AttackStyle = 'melee' | 'ranged';
type ElementKind = 'fire' | 'ice' | 'lightning' | 'poison' | 'shadow' | 'holy';

interface DamageInstance {
  category: DamageCategory;
  style?: AttackStyle;
  element?: ElementKind;
  amount: number;
  isCrit?: boolean;
  isBlocked?: boolean;
  sourceSkill?: string;
}

// 装备词缀 Tag
type AffixTag =
  | 'universal' | 'physical' | 'magic' | 'ranged'
  | 'warrior' | 'mage' | 'ranger'
  | 'fire' | 'ice' | 'lightning' | 'poison' | 'shadow' | 'holy';

// 词缀属性键（基础/二级/特殊）
type AffixStatKey =
  | keyof PrimaryStats
  | keyof DerivedStats
  | 'inc_damage' | 'more_damage'
  | 'elite_damage' | 'boss_damage'
  | 'bleed_chance' | 'extra_element'
  | 'gold_bonus' | 'exp_bonus' | 'luck_bonus';

// 词缀定义（池）
interface AffixDef {
  id: string;
  name: string;
  tags: AffixTag[];           // 出现限制：装备无此 tag 则不出此词缀
  stat: AffixStatKey;
  valueRange: [number, number];
  tierWeights: number[];      // 按 AFFIX_TIERS 长度
}

// 词缀实例（装备上）
interface Affix {
  defId: string;              // 引用 AffixDef
  name: string;
  stat: AffixStatKey;
  value: number;
  tier: number;
}

// 装备
interface Equipment {
  id: string;
  templateId: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  baseStats: Partial<PrimaryStats>;  // 6维基础
  affixes: Affix[];
  element?: ElementKind;      // 元素伤害标记
  requiredLevel: number;
  icon: string;
}

// 怪物定义
interface MonsterDef {
  id: string;
  name: string;
  level: number;
  baseStats: PrimaryStats;    // 6维基础
  tags: string[];             // 'undead' / 'element' / 等
  icon: string;
  isBoss: boolean;
  loot: LootEntry[];
}

// Hero 扩展
interface Hero {
  id: string;
  name: string;
  class: HeroClass;
  level: number;
  exp: number;
  stats: PrimaryStats;        // 改为 6 维
  equipment: Equipment[];
  skills: Skill[];
  petSlots: Pet[];
  talentPoints: number;
  spentPoints: number;
  learnedTalents: Record<string, number>;
}

// TurnState 扩展
interface TurnState {
  phase: BattlePhase;
  heroHp: number;
  heroMaxHp: number;
  heroRage: number;
  heroMaxRage: number;
  heroDefending: boolean;
  heroShield: number;
  heroChargeBonus: number;
  heroDerived: DerivedStats;   // 新增：英雄二级属性
  enemyHp: number;
  enemyMaxHp: number;
  enemyDef: number;
  enemyAtk: number;
  enemySpeed: number;
  enemyIsBoss: boolean;
  enemyName: string;
  enemyIcon: string;
  enemyTags: string[];         // 新增：怪物标记
  enemyDerived: DerivedStats;  // 新增：怪物二级属性
  waveIndex: number;
  totalWaves: number;
  turnCount: number;
  log: TurnLogEntry[];
  heroBuffs: TurnBuff[];
  enemyBuffs: TurnBuff[];
}

// Buff 扩展（新增 ice/poison/curse/holy/slow/freeze）
type BuffKind =
  | 'def_down' | 'atk_up' | 'atk_down' | 'def_up'
  | 'stun' | 'bleed' | 'burn' | 'shield' | 'pierce' | 'charging'
  | 'paralyse' | 'taunt' | 'indomitable' | 'counter' | 'rage_gain'
  | 'slow' | 'freeze' | 'poison' | 'curse' | 'holy';

// SkillEffectKind 扩展
type SkillEffectKind =
  | 'stun' | 'bleed' | 'burn' | 'shield' | 'pierce' | 'charge' | 'chain'
  | 'atk_down' | 'def_down' | 'def_up' | 'heal' | 'paralyse' | 'taunt'
  | 'multi_target' | 'indomitable' | 'rage_gain' | 'counter' | 'atk_up'
  | 'slow' | 'freeze' | 'poison' | 'curse' | 'holy';

// PlayerSave v3
interface PlayerSave {
  version: 3;
  hero: Hero;
  buildings: Building[];
  resources: Resources;
  stage: number;
  highestStage: number;
  levelProgress: Record<string, LevelProgress>;
  lastOnlineAt: number;
  createdAt: number;
  updatedAt: number;
}
```

### 2. balance.ts 新增公式常量

```ts
// 二级属性计算标量
STAT_SCALARS = {
  STR_TO_PHYSICAL_ATTACK: 2,
  STR_TO_BLOCK_VALUE: 1,
  AGI_TO_RANGED_ATTACK: 2,
  AGI_TO_CRIT_RATE: 0.005,
  AGI_TO_EVADE: 0.005,
  AGI_TO_SPEED: 1,
  INT_TO_MAGIC_ATTACK: 2,
  INT_TO_MAGIC_CRIT_RATE: 0.004,
  INT_TO_MAGIC_RESIST: 1,
  VIT_TO_MAX_HP: 10,
  VIT_TO_HP_REGEN: 0.5,
  VIT_TO_ARMOR: 2,
  SPI_TO_STATUS_RESIST: 0.01,
  SPI_TO_CRIT_DAMAGE_REDUCTION: 0.005,
  SPI_TO_RESOURCE_REGEN: 0.2,
  LUCK_TO_RARITY_BONUS: 0.005,
  LUCK_TO_AFFIX_BONUS: 0.003,
};

// 二级属性基础值
DERIVED_BASE = {
  MAX_HP: 100, MAX_RESOURCE: 100,
  CRIT_RATE: 0.05, CRIT_DAMAGE: 1.5,
  ACCURACY: 0.95, EVADE: 0,
  BLOCK_RATE: 0, BLOCK_VALUE: 0, BLOCK_PERCENT: 0,
  ARMOR: 0, MAGIC_RESIST: 0,
  ARMOR_PIERCE: 0, MAGIC_PIERCE: 0,
  PHYSICAL_LEECH: 0, MAGIC_LEECH: 0,
  HP_REGEN: 0, RESOURCE_REGEN: 0,
  COOLDOWN_REDUCTION: 0, STATUS_RESIST: 0,
  DAMAGE_REFLECT: 0, SPEED: 10,
};

// 新元素参数
SLOW_SPEED_REDUCTION: 0.3,      // 减速30%速度
FREEZE_SKIP_CHANCE: 1.0,
POISON_STACK_MAX: 5,            // 毒素最多叠加5层
CURSE_STAT_REDUCTION: 0.2,      // 诅咒降属性20%
HOLY_UNDEAD_BONUS: 0.5,         // 神圣对亡灵+50%伤害
HOLY_HEAL_RATE: 0.1,            // 神圣对非亡灵治疗10%最大生命
BLOCK_PERCENT_CAP: 0.75,        // 格挡百分比上限75%
STATUS_RESIST_CAP: 0.9,         // 异常抗性上限90%
```

### 3. combat.ts 重写

```ts
// 计算二级属性
calcDerivedStats(base: PrimaryStats, equipment: Equipment[], level: number): DerivedStats
  // 1. 聚合装备 baseStats → combinedPrimary
  // 2. 按公式计算二级属性基础值
  // 3. 聚合装备 affixes 中 DerivedStats 键的词缀加成
  // 4. 应用等级加成
  // 5. 返回 DerivedStats

// 计算伤害（核心函数）
calcDamage(attacker: DerivedStats, defender: DerivedStats, instance: DamageInstance): DamageResult
  // 1. 命中判定: accuracy vs evade（未命中返回 amount=0）
  // 2. 暴击判定: critRate vs roll → isCrit → amount *= critDamage
  // 3. 格挡判定: blockRate vs roll → isBlocked
  // 4. 选择减伤源: physical→armor, magic→magicResist
  // 5. 穿透计算: pierce 无视对应比例护甲/魔抗
  // 6. 减伤公式: damageReduction = armor / (armor + K)  (K=常数, 递减曲线)
  // 7. 格挡减伤: if isBlocked → amount *= (1-blockPercent); amount -= blockValue
  // 8. 元素加成: holy vs undead → amount *= (1+HOLY_UNDEAD_BONUS)
  // 9. 返回 { amount, isCrit, isBlocked, isHit }

// 保留但更新
calcPhysicalDamage / calcMagicDamage → 改为基于 DerivedStats
calcDamageReduction → 改为基于 armor/magicResist 公式
rollCrit → 基于 DerivedStats.critRate
calcFinalStats → 删除（被 calcDerivedStats 替代）
simulateCombat → 兼容新属性
```

### 4. loot.ts 重写（词缀池 + Tag）

```ts
// 完整词缀池（~30+ 词缀）
AFFIX_DEFS: AffixDef[] = [
  // 基础属性（universal）
  { id: 'affix_str', tags: ['universal','warrior'], stat: 'strength', ... },
  { id: 'affix_agi', tags: ['universal','ranger'], stat: 'agility', ... },
  { id: 'affix_int', tags: ['universal','mage'], stat: 'intelligence', ... },
  { id: 'affix_vit', tags: ['universal'], stat: 'vitality', ... },
  { id: 'affix_spi', tags: ['universal'], stat: 'spirit', ... },
  { id: 'affix_luck', tags: ['universal'], stat: 'luck', ... },
  // 攻击属性
  { id: 'affix_phys_atk', tags: ['physical','warrior'], stat: 'physicalAttack', ... },
  { id: 'affix_ranged_atk', tags: ['ranged','ranger'], stat: 'rangedAttack', ... },
  { id: 'affix_magic_atk', tags: ['magic','mage'], stat: 'magicAttack', ... },
  { id: 'affix_crit_rate', tags: ['universal'], stat: 'critRate', ... },
  { id: 'affix_crit_dmg', tags: ['universal'], stat: 'critDamage', ... },
  // 防御属性
  { id: 'affix_armor', tags: ['universal'], stat: 'armor', ... },
  { id: 'affix_magic_resist', tags: ['universal'], stat: 'magicResist', ... },
  { id: 'affix_block_rate', tags: ['physical','warrior'], stat: 'blockRate', ... },
  { id: 'affix_block_value', tags: ['physical','warrior'], stat: 'blockValue', ... },
  // 穿透
  { id: 'affix_armor_pierce', tags: ['physical'], stat: 'armorPierce', ... },
  { id: 'affix_magic_pierce', tags: ['magic'], stat: 'magicPierce', ... },
  // 吸血
  { id: 'affix_phys_leech', tags: ['physical'], stat: 'physicalLeech', ... },
  { id: 'affix_magic_leech', tags: ['magic'], stat: 'magicLeech', ... },
  // 回复
  { id: 'affix_hp_regen', tags: ['universal'], stat: 'hpRegen', ... },
  { id: 'affix_res_regen', tags: ['universal'], stat: 'resourceRegen', ... },
  // 通用
  { id: 'affix_speed', tags: ['universal'], stat: 'speed', ... },
  { id: 'affix_status_resist', tags: ['universal'], stat: 'statusResist', ... },
  { id: 'affix_damage_reflect', tags: ['universal'], stat: 'damageReflect', ... },
  { id: 'affix_accuracy', tags: ['universal'], stat: 'accuracy', ... },
  { id: 'affix_evade', tags: ['universal'], stat: 'evade', ... },
  // 特殊词缀
  { id: 'affix_inc_damage', tags: ['universal'], stat: 'inc_damage', ... },
  { id: 'affix_more_damage', tags: ['universal'], stat: 'more_damage', ... },
  { id: 'affix_elite_damage', tags: ['universal'], stat: 'elite_damage', ... },
  { id: 'affix_boss_damage', tags: ['universal'], stat: 'boss_damage', ... },
  { id: 'affix_bleed_chance', tags: ['physical'], stat: 'bleed_chance', ... },
  { id: 'affix_gold_bonus', tags: ['universal'], stat: 'gold_bonus', ... },
  { id: 'affix_exp_bonus', tags: ['universal'], stat: 'exp_bonus', ... },
];

// rollAffix(equipmentTags: AffixTag[], rarity: Rarity): Affix
//   1. filter AFFIX_DEFS by tags 交集非空
//   2. 按 tierWeights 加权随机选 def
//   3. roll value in valueRange
//   4. 返回 Affix 实例

// generateEquipment(template, level, rarity, heroTags): Equipment
//   1. baseStats from template
//   2. affixes by rarity count + heroTags filter
//   3. element from template (if any)
```

### 5. turnBasedCombat.ts 改动

- `initTurnState`：调 `calcDerivedStats` 算 heroDerived/enemyDerived，maxHp/maxRage 用二级属性
- `runTurn`/`runEnemyTurn`：用 `calcDamage` 替代手算伤害
- 新增 `processElementEffects`：处理 slow/freeze/poison/curse/holy
- `processStartOfTurn`：加 hpRegen/resourceRegen 回复
- 命中/格挡/吸血/反弹：在 `resolveAttack`/`resolveSkill` 中结算
- `calcBattleReward`：运气影响掉落品质

### 6. 文件改动清单

| 文件 | 改动 |
|------|------|
| shared/types/index.ts | 大改：PrimaryStats/DerivedStats/DamageInstance/AffixDef/Affix/MonsterDef/TurnState/BuffKind |
| shared/constants/balance.ts | 加 STAT_SCALARS/DERIVED_BASE/新元素参数 |
| shared/constants/equipment.ts | EQUIP_TEMPLATES baseStats 改 6 维 |
| shared/constants/defaults.ts | DEFAULT_HERO_STATS 改 6 维（加 spirit/luck） |
| shared/constants/levels.ts | LEVELS 怪物改 6 维 baseStats + tags |
| shared/logic/combat.ts | 重写：calcDerivedStats/calcDamage/减伤公式 |
| shared/logic/loot.ts | 重写：AFFIX_DEFS 池 + Tag 系统 + rollAffix |
| shared/logic/turnBasedCombat.ts | 大改：战斗用 DerivedStats + 新元素效果 |
| client/stores/gameStore.ts | SAVE_VERSION=3 + loadGame 兼容 |
| client/components/CharacterPanel.tsx | 重写：基础/详细双视图 |

### 7. 兼容性与迁移

- HeroStats 别名 = PrimaryStats，保留向后兼容
- 旧 Skill/Affix 引用 keyof HeroStats 的地方自动兼容 6 维
- simulateCombat 保留但适配新属性
- SAVE_VERSION=3，loadGame 非 v3 返回 false

### 8. 扩展性设计

- 新增元素：只需加 ElementKind 成员 + SkillEffectKind/BuffKind 成员 + balance 参数 + effect 处理分支
- 新增二级属性：只需加 DerivedStats 字段 + DERIVED_BASE + 公式常量 + calcDerivedStats 聚合
- 新增词缀：只需加 AffixDef 条目
- 新增职业：只需加 HeroClass 成员 + 职业专属 tag + 资源类型
- 战斗公式分层：calcDamage 不改核心，新增伤害修饰在 DamageInstance 构造时处理
