/**
 * DarkLoop - 共享类型定义
 * 客户端和服务端共同使用，保证一致性
 */

// ─── 基础 ───────────────────────────────────────────

export type EntityId = string;
export type Timestamp = number;

// ─── 角色系统 ─────────────────────────────────────────

export enum HeroClass {
  Warrior = 'warrior',
  Mage = 'mage',
  Ranger = 'ranger',
}

// 基础属性 6 维（存档持久化）
export interface PrimaryStats {
  strength: number;       // 力量：近战物理攻击力、格挡值
  agility: number;        // 敏捷：远程攻击力、物理暴击率、闪避率
  intelligence: number;   // 智力：魔法攻击力、魔法暴击率、魔法抗性
  vitality: number;       // 体力：生命值上限、生命回复、护甲
  spirit: number;         // 精神：异常状态抗性、暴击伤害减免、宠物伤害继承率
  luck: number;           // 运气：掉落品质和稀有词缀概率
}

// 向后兼容别名
export type HeroStats = PrimaryStats;

// 二级属性（运行时由基础属性+装备+词缀计算，不存档）
export interface DerivedStats {
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

export type LearnedTalents = Record<string, number>;

export interface Hero {
  id: EntityId;
  name: string;
  class: HeroClass;
  level: number;
  exp: number;
  stats: PrimaryStats;
  equipment: Equipment[];
  skills: Skill[];
  petSlots: Pet[];
  talentPoints: number;
  spentPoints: number;
  learnedTalents: LearnedTalents;
}

// ─── 伤害类型 ─────────────────────────────────────────

export type DamageCategory = 'physical' | 'magic';
export type AttackStyle = 'melee' | 'ranged';
export type ElementKind = 'fire' | 'ice' | 'lightning' | 'poison' | 'shadow' | 'holy';

export interface DamageInstance {
  category: DamageCategory;
  style?: AttackStyle;
  element?: ElementKind;
  amount: number;
  isCrit?: boolean;
  isBlocked?: boolean;
  sourceSkill?: string;
}

export interface DamageResult {
  amount: number;
  isCrit: boolean;
  isBlocked: boolean;
  isHit: boolean;
}

// ─── 装备与词缀系统 ────────────────────────────────────

export enum Rarity {
  Normal = 'normal',
  Magic = 'magic',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
  Apex = 'apex',
}

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

// 词缀类型
export type AffixKind = 'prefix' | 'suffix';

// 词缀 Tag：限制词缀可出现的职业/类型/部位
export type AffixTag =
  | 'universal' | 'physical' | 'magic' | 'ranged'
  | 'warrior' | 'mage' | 'ranger'
  | 'weapon' | 'offhand' | 'armor' | 'helmet' | 'boots' | 'ring' | 'amulet'
  | 'offensive' | 'defensive' | 'support'
  | 'fire' | 'ice' | 'lightning' | 'poison' | 'shadow' | 'holy';

// 词缀属性键：基础属性 / 二级属性 / 特殊词缀
export type AffixStatKey =
  | keyof PrimaryStats
  | keyof DerivedStats
  | 'inc_damage' | 'more_damage'
  | 'elite_damage' | 'boss_damage'
  | 'bleed_chance' | 'extra_element'
  | 'gold_bonus' | 'exp_bonus' | 'luck_bonus';

// 词缀定义（词缀池静态数据）
export interface AffixDef {
  id: string;
  name: string;
  kind: AffixKind;
  group: string;
  tags: AffixTag[];
  stat: AffixStatKey;
  baseRange: [number, number];
  nameWord?: { prefix?: string; suffix?: string };
}

// 隐式词缀定义（基底自带）
export interface ImplicitModDef {
  stat: AffixStatKey;
  baseRange: [number, number];
  name: string;
}

// roll 出的词缀实例
export interface RolledMod {
  defId: string;
  name: string;
  stat: AffixStatKey;
  value: number;
  tier: number;
  kind: AffixKind;
}

// 基底定义（静态数据）
export interface BaseType {
  id: string;
  name: string;
  typeName: string;
  slot: EquipSlot;
  itemClass: string;
  minLevel: number;
  baseStats: Partial<PrimaryStats>;
  implicit?: ImplicitModDef;
  twoHanded: boolean;
  classRestriction: HeroClass[];
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
  enchantments?: RolledMod[];
  corrupted?: boolean;
  requiredLevel: number;
  icon: string;
}

/** @deprecated 使用 RolledMod 代替 */
export type Affix = RolledMod;

// ─── 技能系统 ─────────────────────────────────────────

export enum SkillType {
  Active = 'active',
  Passive = 'passive',
}

export type SkillEffectKind =
  | 'stun' | 'bleed' | 'burn' | 'shield' | 'pierce' | 'charge' | 'chain'
  | 'atk_down' | 'def_down' | 'def_up' | 'heal' | 'paralyse' | 'taunt'
  | 'multi_target' | 'indomitable' | 'rage_gain' | 'counter' | 'atk_up'
  | 'slow' | 'freeze' | 'poison' | 'curse' | 'holy';

export interface SkillEffect {
  kind: SkillEffectKind;
  chance?: number;
  value?: number;
  duration?: number;
  extraHits?: number;
}

/** 技能目标选择模式 */
export type SkillTargeting =
  | 'single'      // 单体：手动选1个敌方目标
  | 'chain'       // 连锁：手动选1个，自动波及N个（不可选）
  | 'multi'       // 多选：手动选N个目标
  | 'auto_all'    // 全体自动：无需选择，命中所有敌方
  | 'self';       // 自身：无需选择，作用于自己

/** 连锁目标选择策略 */
export type ChainSelection = 'random' | 'lowest_hp' | 'nearest';

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  cooldown: number;
  damageMultiplier: number;
  level: number;
  maxLevel: number;
  icon: string;
  rageCost: number;
  effects?: SkillEffect[];
  selfEffects?: SkillEffect[];
  chargeSkill?: boolean;
  effectName?: string;
  /** 目标模式，默认 'single' */
  targeting?: SkillTargeting;
  /** 连锁/多选时的目标数量（含主目标） */
  targetCount?: number;
  /** 连锁技能的次要目标选择策略 */
  chainSelection?: ChainSelection;
  /** 连锁伤害衰减率（每次波及伤害 = 前一次 * 衰减率，默认0.7） */
  chainDecay?: number;
  /** AOE/连锁时每个目标的伤害倍率修正（默认1.0） */
  multiTargetDamageRate?: number;
}

// ─── 天赋盘系统 ─────────────────────────────────────────

export type TalentNodeKind = 'label' | 'skill' | 'upgrade';

export interface TalentNode {
  id: string;
  tier: number;
  kind: TalentNodeKind;
  name: string;
  desc: string;
  icon: string;
  skillId?: string;
  parentSkillId?: string;
  modifiers?: TalentModifier[];
  requires?: string[];
  exclusiveGroup?: string;
  maxRank: number;
}

export type TalentModifier =
  | { kind: 'add_effect'; effect: SkillEffect }
  | { kind: 'remove_effect'; effectKind: SkillEffectKind }
  | { kind: 'skill_damage_boost'; multiplier: number }
  | { kind: 'skill_rage_cost_reduce'; reduce: number };

export interface TalentTier {
  tier: number;
  label: string;
  unlockAt: number;
  skillNodeIds: string[];
  upgradeNodeIds: string[];
}

export interface TalentTree {
  class: HeroClass;
  label: TalentNode;
  nodes: TalentNode[];
  tiers: TalentTier[];
}

// ─── 资源货币系统 ─────────────────────────────────────────

export enum ResourceKind {
  Gold = 'gold',
  Exp = 'exp',
  Gems = 'gems',
  Badge = 'badge',
}

export interface Resources {
  gold: number;
  exp: number;
  gems: number;
  badge: number;
}

// ─── 宠物系统 ─────────────────────────────────────────

export interface Pet {
  id: EntityId;
  name: string;
  templateId: string;
  level: number;
  stats: Partial<PrimaryStats>;
  skill?: Skill;
  icon: string;
}

// ─── 怪物与关卡 ─────────────────────────────────────────

/** 怪物模板（静态定义，可复用） */
export interface MonsterTemplate {
  id: string;
  name: string;
  baseStats: PrimaryStats;           // 1级时的基础属性
  statGrowth: Partial<PrimaryStats>; // 每级成长率
  skills: string[];                  // 技能ID列表（引用 SKILL_MAP）
  tags: string[];
  icon: string;
  isBoss?: boolean;
  isElite?: boolean;
  loot: LootEntry[];
}

/** 怪物战斗实例（运行时生成，按等级缩放） */
export interface EnemyCombatState {
  uid: string;              // 唯一实例ID（同模板多实例区分）
  templateId: string;
  name: string;
  icon: string;
  level: number;
  hp: number;
  maxHp: number;
  derived: DerivedStats;    // 由缩放后属性计算
  tags: string[];
  isBoss: boolean;
  isElite: boolean;
  buffs: TurnBuff[];
  alive: boolean;
  skills: Skill[];          // 从模板加载的技能实例
  loot: LootEntry[];
}

/** 波次定义（引用怪物模板+等级） */
export interface WaveDef {
  monsters: { templateId: string; level: number }[];
}

/** 关卡定义 */
export interface LevelDef {
  id: string;               // 如 '1-1'
  regionId: string;
  stageNum: number;          // 1-10
  name: string;              // 显示名
  desc: string;
  recommendLevel: number;
  waves: WaveDef[];
  firstClearReward: Partial<Resources>;
}

/** 大地区定义 */
export interface RegionDef {
  id: string;
  name: string;
  desc: string;
  theme: string;
  levels: LevelDef[];
}

export interface LevelProgress {
  cleared: boolean;
  stars: number;
  firstClearClaimed: boolean;
}

/** @deprecated 由 MonsterTemplate 替代 */
export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  baseStats: PrimaryStats;
  tags: string[];
  icon: string;
  isBoss?: boolean;
  loot: LootEntry[];
}

// ─── 战斗系统 ─────────────────────────────────────────

/** @deprecated 由 EnemyCombatState 替代 */
export interface Monster {
  id: EntityId;
  templateId: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  baseStats: PrimaryStats;
  tags: string[];
  lootTable: LootEntry[];
}

export interface LootEntry {
  templateId: string;
  type: 'equipment' | 'gold' | 'exp' | 'pet';
  dropRate: number;
  quantity?: [number, number];
}

export interface CombatResult {
  duration: number;
  heroHpRemaining: number;
  monsterDefeated: boolean;
  rewards: Reward[];
  log: CombatLogEntry[];
}

export interface CombatLogEntry {
  timestamp: number;
  type: 'attack' | 'skill' | 'damage' | 'heal' | 'death';
  source: string;
  target: string;
  value: number;
}

export interface Reward {
  type: 'gold' | 'exp' | 'equipment' | 'pet' | 'gems' | 'badge';
  amount?: number;
  item?: Equipment | Pet;
}

// ─── 回合制战斗状态机 ───────────────────────────────────

export type BattlePhase = 'player' | 'enemy' | 'anim' | 'win' | 'lose' | 'flee';

export type TurnActionKind = 'attack' | 'skill' | 'defend' | 'flee' | 'dot';

export interface TurnAction {
  kind: TurnActionKind;
  skillId?: string;
  targetUid?: string;     // 单体/连锁的主目标
  targetUids?: string[];  // 多选模式的多个目标
}

export type BuffKind =
  | 'def_down' | 'atk_up' | 'def_up'
  | 'stun' | 'bleed' | 'burn' | 'shield' | 'pierce'
  | 'charging' | 'atk_down' | 'paralyse' | 'taunt' | 'indomitable'
  | 'counter' | 'rage_gain'
  | 'slow' | 'freeze' | 'poison' | 'curse' | 'holy';

export interface TurnBuff {
  kind: BuffKind;
  value: number;
  remainingTurns: number;
  sourceSkill?: string;
}

export interface TurnState {
  phase: BattlePhase;

  // ── 英雄状态 ──
  heroHp: number;
  heroMaxHp: number;
  heroRage: number;
  heroMaxRage: number;
  heroDefending: boolean;
  heroShield: number;
  heroChargeBonus: number;
  heroDerived: DerivedStats;
  heroBuffs: TurnBuff[];
  heroLevel: number;

  // ── 敌人状态（数组，替代原单个敌人字段） ──
  enemies: EnemyCombatState[];
  currentEnemyIndex: number;   // 当前行动的敌人索引

  // ── 目标选择 ──
  selectedTargetUid: string | null;  // 玩家选中的目标
  targetingMode: boolean;            // 是否处于选目标模式
  pendingSkillId: string | null;     // 等待选目标的技能

  // ── 波次 ──
  waveIndex: number;
  totalWaves: number;

  // ── 其他 ──
  turnCount: number;
  log: TurnLogEntry[];
}

export interface TurnLogEntry {
  turn: number;
  actor: 'hero' | 'enemy';
  action: TurnActionKind;
  skillName?: string;
  skillId?: string;
  damage?: number;
  damageType?: string;
  rageGain?: number;
  crit?: boolean;
  defeated?: boolean;
  targetUid?: string;    // 攻击目标UID
  enemyIndex?: number;   // 行动敌人索引（敌方行动时）
}

// ─── 建筑系统 ─────────────────────────────────────────

export enum BuildingType {
  Blacksmith = 'blacksmith',
  AlchemyLab = 'alchemy_lab',
  TrainingGround = 'training',
  PetHouse = 'pet_house',
}

export interface Building {
  type: BuildingType;
  level: number;
  maxLevel: number;
  effects: BuildingEffect[];
}

export interface BuildingEffect {
  type: 'offline_rate' | 'exp_bonus' | 'drop_rate' | 'pet_exp';
  value: number;
}

// ─── 玩家存档 ─────────────────────────────────────────

export interface PlayerSave {
  version: number;
  hero: Hero;
  buildings: Building[];
  resources: Resources;
  levelProgress: Record<string, LevelProgress>;
  lastOnlineAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── 离线收益 ─────────────────────────────────────────

export interface OfflineReward {
  duration: number;
  goldEarned: number;
  expEarned: number;
  stagesCleared: number;
  itemsFound: Equipment[];
}

// ─── 网络协议 (为多人联机预留) ──────────────────────────

export enum ServerEvent {
  PlayerSync = 'player:sync',
  PlayerAction = 'player:action',
  ChatMessage = 'chat:message',
  JoinRoom = 'room:join',
  LeaveRoom = 'room:leave',

  PlayerUpdate = 'player:update',
  CombatBroadcast = 'combat:broadcast',
  RoomState = 'room:state',
  SystemMessage = 'system:message',
  OfflineReward = 'offline:reward',
}

export interface SocketMessage<T = unknown> {
  event: ServerEvent;
  data: T;
  timestamp: Timestamp;
}
