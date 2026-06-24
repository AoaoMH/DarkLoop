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
  Common = 'common',
  Fine = 'fine',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
  Mythic = 'mythic',
  Apex = 'apex',
}

export enum EquipSlot {
  Weapon = 'weapon',
  Armor = 'armor',
  Helmet = 'helmet',
  Boots = 'boots',
  Ring = 'ring',
  Amulet = 'amulet',
}

// 词缀 Tag：限制词缀可出现的职业/类型
export type AffixTag =
  | 'universal' | 'physical' | 'magic' | 'ranged'
  | 'warrior' | 'mage' | 'ranger'
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
  tags: AffixTag[];
  stat: AffixStatKey;
  valueRange: [number, number];
  tierWeights: number[];
}

// 词缀实例（装备上）
export interface Affix {
  defId: string;
  name: string;
  stat: AffixStatKey;
  value: number;
  tier: number;
}

export interface Equipment {
  id: EntityId;
  templateId: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  baseStats: Partial<PrimaryStats>;
  affixes: Affix[];
  element?: ElementKind;
  requiredLevel: number;
  icon: string;
}

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

export interface WaveDef {
  monsters: MonsterDef[];
}

export interface LevelDef {
  id: string;
  name: string;
  desc: string;
  difficulty: number;
  recommendLevel: number;
  waves: WaveDef[];
  firstClearReward: Partial<Resources>;
}

export interface LevelProgress {
  cleared: boolean;
  stars: number;
  firstClearClaimed: boolean;
}

// ─── 战斗系统 ─────────────────────────────────────────

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

export type TurnActionKind = 'attack' | 'skill' | 'defend' | 'flee';

export interface TurnAction {
  kind: TurnActionKind;
  skillId?: string;
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
  heroHp: number;
  heroMaxHp: number;
  heroRage: number;
  heroMaxRage: number;
  heroDefending: boolean;
  heroShield: number;
  heroChargeBonus: number;
  heroDerived: DerivedStats;
  enemyHp: number;
  enemyMaxHp: number;
  enemyDef: number;
  enemyAtk: number;
  enemySpeed: number;
  enemyIsBoss: boolean;
  enemyName: string;
  enemyIcon: string;
  enemyTags: string[];
  enemyDerived: DerivedStats;
  waveIndex: number;
  totalWaves: number;
  turnCount: number;
  log: TurnLogEntry[];
  heroBuffs: TurnBuff[];
  enemyBuffs: TurnBuff[];
}

export interface TurnLogEntry {
  turn: number;
  actor: 'hero' | 'enemy';
  action: TurnActionKind;
  skillName?: string;
  damage?: number;
  rageGain?: number;
  crit?: boolean;
  defeated?: boolean;
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
  stage: number;
  highestStage: number;
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
