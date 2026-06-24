/**
 * 游戏平衡常量
 * 客户端/服务端共享，保证计算一致性
 */

export const GAME_BALANCE = {
  // 基础攻击
  BASE_ATTACK: 10,
  DAMAGE_VARIANCE: 0.2,     // 伤害浮动 ±20%

  // 属性缩放
  STR_SCALAR: 0.01,         // 力量对物理伤害的加成系数
  INT_SCALAR: 0.01,         // 智力对法术伤害的加成系数
  VIT_DEFENSE_SCALAR: 0.5,  // 体质对防御的加成系数
  HP_PER_VIT: 10,           // 每点体质增加的HP
  BASE_HP: 100,             // 基础HP

  // 战斗节奏
  COMBAT_TICK_MS: 100,      // 战斗计算间隔（毫秒）
  MAX_COMBAT_DURATION: 60_000, // 单次战斗最大时长（毫秒）

  // 掉落
  BASE_GOLD_PER_KILL: 5,
  BASE_EXP_PER_KILL: 10,

  // 经验曲线
  EXP_BASE: 100,            // 1级所需经验
  EXP_GROWTH: 1.15,         // 每级经验增长倍率

  // 离线挂机
  MAX_OFFLINE_HOURS: 24,    // 最大离线计算时长
  OFFLINE_EFFICIENCY: 0.5,  // 离线效率（相对于在线）

  // 回合制·怒气系统
  RAGE_MAX: 100,            // 怒气上限
  RAGE_PER_ATTACK: 10,      // 攻击积怒
  RAGE_PER_HIT: 15,         // 受击积怒
  RAGE_PER_BLOCK: 20,       // 防御积怒
  RAGE_TURN_START_BONUS: 0, // 回合开始基础怒气（天赋可加成）

  // 回合制·防御
  BLOCK_DAMAGE_REDUCTION: 0.5, // 防御减伤 50%
  FLEE_BASE_CHANCE: 0.3,       // 逃跑基础成功率
  FLEE_SPEED_FACTOR: 0.01,     // 每点速度差影响逃跑率

  // 回合制·Boss
  BOSS_SKILL_CHANCE: 0.3,      // Boss 每回合用技能概率
  BOSS_SKILL_MULTIPLIER: 1.5,  // Boss 技能伤害倍率

  // 回合制·状态机制
  BLEED_FIXED: true,           // 流血按固定数值（false=按百分比）
  BURN_FIXED: true,            // 燃烧按固定数值
  SHIELD_DECAY_PER_TURN: 0,    // 护盾每回合衰减（0=不衰减，回合到时消失）
  CHARGE_CRIT_BONUS: 0.3,      // 蓄力释放暴击率加成
  COUNTER_DURATION_DEFAULT: 1, // 反伤默认持续回合
  INDOMITABLE_HEAL_RATE: 0.15, // 不屈触发回血比例（最大生命）
  INDOMITABLE_REDUCTION: 0.5,  // 不屈触发减伤比例
  STUN_SKIP_CHANCE: 1.0,       // 眩晕跳过回合概率（1.0=必定跳过）
  PARALYSE_SKIP_CHANCE: 1.0,   // 麻痹跳过回合概率
  PIERCE_IGNORE_RATIO: true,   // 破甲按比例无视防御
  MULTI_TARGET_DAMAGE_RATE: 0.5, // 多目标额外攻击伤害倍率

  // ─── 属性系统 v2 ───

  // 基础属性 → 二级属性 标量
  STAT_SCALARS: {
    STR_TO_PHYSICAL_ATTACK: 1,    // 力量→物理攻击力
    STR_TO_BLOCK_VALUE: 1,        // 力量→格挡固定值
    AGI_TO_RANGED_ATTACK: 1,      // 敏捷→远程攻击力
    AGI_TO_CRIT_RATE: 0.005,      // 敏捷→物理暴击率
    AGI_TO_EVADE: 0.005,          // 敏捷→闪避率
    AGI_TO_SPEED: 1,              // 敏捷→速度
    INT_TO_MAGIC_ATTACK: 1,       // 智力→魔法攻击力
    INT_TO_MAGIC_CRIT_RATE: 0.004,// 智力→魔法暴击率
    INT_TO_MAGIC_RESIST: 1,       // 智力→魔法抗性
    VIT_TO_MAX_HP: 10,            // 体力→最大生命值
    VIT_TO_HP_REGEN: 0.5,         // 体力→每回合生命回复
    VIT_TO_ARMOR: 2,              // 体力→护甲
    SPI_TO_STATUS_RESIST: 0.01,   // 精神→异常状态抗性
    SPI_TO_CRIT_DAMAGE_REDUCTION: 0.005, // 精神→暴击伤害减免
    SPI_TO_RESOURCE_REGEN: 0.2,   // 精神→每回合资源回复
    LUCK_TO_RARITY_BONUS: 0.005,  // 运气→稀有度加成
    LUCK_TO_AFFIX_BONUS: 0.003,   // 运气→词缀加成
  },

  // 二级属性基础值
  DERIVED_BASE: {
    maxHp: 50,
    maxResource: 100,
    physicalAttack: 5,
    rangedAttack: 5,
    magicAttack: 5,
    armor: 0,
    magicResist: 0,
    critRate: 0.05,
    critDamage: 1.5,
    accuracy: 0.95,
    evade: 0,
    blockRate: 0,
    blockValue: 0,
    blockPercent: 0,
    armorPierce: 0,
    magicPierce: 0,
    physicalLeech: 0,
    magicLeech: 0,
    hpRegen: 0,
    resourceRegen: 0,
    cooldownReduction: 0,
    statusResist: 0,
    damageReflect: 0,
    speed: 10,
  },

  // 减伤公式常数（armor / (armor + K) 递减曲线）
  ARMOR_K: 100,
  MAGIC_RESIST_K: 100,

  // 上限
  BLOCK_PERCENT_CAP: 0.75,        // 格挡百分比减伤上限
  STATUS_RESIST_CAP: 0.9,         // 异常抗性上限
  EVADE_CAP: 0.6,                 // 闪避上限
  CRIT_RATE_CAP: 0.95,            // 暴击率上限

  // ─── 元素效果 v2 ───
  SLOW_SPEED_REDUCTION: 0.3,      // 减速降低 30% 速度
  FREEZE_SKIP_CHANCE: 1.0,        // 冰冻跳过回合概率
  POISON_STACK_MAX: 5,            // 毒素最多叠加 5 层
  CURSE_STAT_REDUCTION: 0.2,      // 诅咒降低 20% 属性
  HOLY_UNDEAD_BONUS: 0.5,         // 神圣对亡灵 +50% 伤害
  HOLY_HEAL_RATE: 0.1,            // 神圣对非亡灵治疗 10% 最大生命

  // ─── 等级压制 ───
  LEVEL_SUPPRESSION_RATE: 0.07,   // 每级差 ±7% 伤害
  LEVEL_SUPPRESSION_MIN: 0.15,    // 最低造成 15% 伤害
  LEVEL_SUPPRESSION_MAX: 3.0,     // 最高造成 300% 伤害
} as const;
