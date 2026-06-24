# 技术设计：关卡怪物系统解耦迭代

## 架构概览

改动跨越三个包：
- `shared`：类型定义、常量数据、战斗逻辑（核心改动）
- `client`：UI组件、游戏状态、战斗场景
- `server`：清理遗留代码

### 文件变更清单

**新增文件：**
| 文件 | 职责 |
|------|------|
| `shared/src/constants/monsters.ts` | 怪物模板定义 |
| `shared/src/constants/regions.ts` | 大地区与关卡定义 |
| `shared/src/logic/monsterScale.ts` | 怪物属性缩放（template → instance） |
| `shared/src/logic/monsterAI.ts` | 怪物效用评分AI |

**修改文件：**
| 文件 | 改动 |
|------|------|
| `shared/src/types/index.ts` | 新增/修改类型定义 |
| `shared/src/constants/skills.ts` | 添加目标模式字段、新增技能、重构现有技能 |
| `shared/src/constants/balance.ts` | 等级压制常量 |
| `shared/src/logic/combat.ts` | calcDamage 加入等级压制 |
| `shared/src/logic/turnBasedCombat.ts` | TurnState 多敌人重构 |
| `client/src/components/AdventureMap.tsx` | 区域选择+关卡网格 |
| `client/src/components/TurnBattleUI.tsx` | 目标选择UI |
| `client/src/game/scenes/BattleScene.ts` | 多敌人渲染 |
| `client/src/stores/gameStore.ts` | 战斗流程更新 |

**删除文件：**
| 文件 | 原因 |
|------|------|
| `server/src/services/templates.ts` | 遗留系统，未接入战斗 |
| `shared/src/constants/levels.ts` | 被 regions.ts 替代 |

---

## 1. 类型定义变更 (`shared/src/types/index.ts`)

### 1.1 新增：技能目标模式

```typescript
/** 技能目标选择模式 */
export type SkillTargeting =
  | 'single'      // 单体：手动选1个敌方目标
  | 'chain'       // 连锁：手动选1个，自动波及N个（不可选）
  | 'multi'       // 多选：手动选N个目标
  | 'auto_all'    // 全体自动：无需选择，命中所有敌方
  | 'self';       // 自身：无需选择，作用于自己

/** 连锁目标选择策略 */
export type ChainSelection = 'random' | 'lowest_hp' | 'nearest';
```

### 1.2 修改：Skill 类型

在现有 `Skill` 接口基础上新增字段：

```typescript
export interface Skill {
  // ... 现有字段保持不变 ...

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
```

### 1.3 新增：怪物模板与实例

```typescript
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
```

### 1.4 修改：关卡与区域

```typescript
/** 波次定义（改为引用怪物模板） */
export interface WaveDef {
  monsters: { templateId: string; level: number }[];
}

/** 关卡定义 */
export interface LevelDef {
  id: string;               // 如 '1-1'
  regionId: string;
  stageNum: number;          // 1-10
  name: string;              // 显示名，如同 stageNum 则用 '1-1'
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

/** 关卡进度（按关卡ID索引） */
export interface LevelProgress {
  cleared: boolean;
  stars: number;
  firstClearClaimed: boolean;
}
```

### 1.5 重构：TurnState（多敌人支持）

```typescript
export interface TurnState {
  phase: BattlePhase;

  // ── 英雄状态（保持不变） ──
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
```

### 1.6 删除：遗留类型

- 删除 `Monster` 接口（由 `EnemyCombatState` 替代）
- 删除 `MonsterDef` 接口（由 `MonsterTemplate` + `WaveDef` 替代）
- 删除 `CombatResult`、`CombatLogEntry`（未使用或被 TurnLogEntry 替代）

---

## 2. 怪物模板系统

### 2.1 怪物模板定义 (`shared/src/constants/monsters.ts`)

```typescript
import type { MonsterTemplate } from '../types';

export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  // ── 区域1：史莱姆平原 ──
  slime_green: {
    id: 'slime_green',
    name: '绿史莱姆',
    baseStats: { str: 2, agi: 2, int: 1, vit: 1, spi: 1, luck: 1 },
    statGrowth: { str: 0.8, agi: 0.6, vit: 1.0, int: 0.3, spi: 0.3, luck: 0.2 },
    skills: ['mob_tackle', 'mob_acid_spit'],
    tags: [],
    icon: '👾',
    loot: [{ templateId: 'sword_basic', type: 'equipment', dropRate: 0.1 }],
  },
  slime_blue: {
    id: 'slime_blue',
    name: '蓝史莱姆',
    baseStats: { str: 3, agi: 2, int: 3, vit: 2, spi: 1, luck: 1 },
    statGrowth: { str: 1.0, agi: 0.8, vit: 1.2, int: 1.0, spi: 0.5, luck: 0.3 },
    skills: ['mob_tackle', 'mob_frost_nova'],
    tags: ['element'],
    icon: '🟦',
    isElite: true,
    loot: [{ templateId: 'sword_steel', type: 'equipment', dropRate: 0.2 }],
  },
  slime_king: {
    id: 'slime_king',
    name: '史莱姆王',
    baseStats: { str: 5, agi: 3, int: 2, vit: 5, spi: 2, luck: 2 },
    statGrowth: { str: 1.5, agi: 1.0, vit: 2.5, int: 0.8, spi: 0.8, luck: 0.5 },
    skills: ['mob_tackle', 'mob_slam', 'mob_split', 'mob_heal'],
    tags: [],
    icon: '👿',
    isBoss: true,
    loot: [{ templateId: 'sword_basic', type: 'equipment', dropRate: 0.4 }],
  },
  // ── 区域2：骸骨墓地 ──
  skeleton: { /* ... */ },
  skeleton_archer: { /* ... */ },
  skeleton_lord: { /* ... isBoss: true ... */ },
  // ── 区域3：恶魔巢穴 ──
  imp: { /* ... */ },
  demon_brute: { /* ... isElite: true ... */ },
  demon_lord: { /* ... isBoss: true ... */ },
  // ── 跨区域复用 ──
  bat: { /* 蝙蝠，出现在区域1和2 */ },
};
```

### 2.2 怪物技能定义

怪物技能在 `skills.ts` 中定义，使用相同 `Skill` 类型，`rageCost: 0`：

```typescript
// ── 怪物通用技能 ──
{
  id: 'mob_tackle',
  name: '冲撞',
  type: SkillType.Active,
  description: '造成 120% 物理伤害',
  damageMultiplier: 1.2,
  rageCost: 0,
  targeting: 'single',
  icon: '💢',
},
{
  id: 'mob_acid_spit',
  name: '酸液喷吐',
  type: SkillType.Active,
  description: '造成 80% 伤害，附加护甲降低 2 回合',
  damageMultiplier: 0.8,
  rageCost: 0,
  targeting: 'single',
  effects: [{ kind: 'def_down', value: 0.3, duration: 2 }],
  icon: '🧪',
},
{
  id: 'mob_frost_nova',
  name: '冰霜新星',
  type: SkillType.Active,
  description: '对全体敌人造成 60% 冰霜伤害',
  damageMultiplier: 0.6,
  rageCost: 0,
  targeting: 'auto_all',
  icon: '❄️',
},
{
  id: 'mob_slam',
  name: '猛击',
  type: SkillType.Active,
  description: '造成 200% 物理伤害',
  damageMultiplier: 2.0,
  rageCost: 0,
  targeting: 'single',
  icon: '💥',
},
{
  id: 'mob_split',
  name: '分裂',
  type: SkillType.Active,
  description: '回复 15% 最大生命',
  damageMultiplier: 0,
  rageCost: 0,
  targeting: 'self',
  selfEffects: [{ kind: 'heal', value: 0.15 }],
  icon: '✨',
},
{
  id: 'mob_heal',
  name: '自愈',
  type: SkillType.Active,
  description: '回复 20% 最大生命',
  damageMultiplier: 0,
  rageCost: 0,
  targeting: 'self',
  selfEffects: [{ kind: 'heal', value: 0.20 }],
  icon: '💚',
},
```

### 2.3 属性缩放函数 (`shared/src/logic/monsterScale.ts`)

```typescript
import type { MonsterTemplate, EnemyCombatState, PrimaryStats, DerivedStats } from '../types';
import { calcDerivedStats } from './combat';
import { SKILL_MAP } from '../constants/skills';

const PRIMARY_KEYS: (keyof PrimaryStats)[] = ['str','agi','int','vit','spi','luck'];

export function scaleMonster(template: MonsterTemplate, level: number): EnemyCombatState {
  // 1. 按成长率缩放基础属性
  const stats: PrimaryStats = { ...template.baseStats };
  const diff = level - 1;
  for (const key of PRIMARY_KEYS) {
    const growth = template.statGrowth[key] ?? 0;
    stats[key] = Math.floor(stats[key] + growth * diff);
  }

  // 2. 计算二级属性（怪物不应用5%等级加成，成长率已覆盖缩放）
  const derived = calcDerivedStats(stats, [], level, false);

  // 3. 加载技能实例
  const skills = template.skills
    .map(id => SKILL_MAP[id])
    .filter(Boolean);

  return {
    uid: `${template.id}_${level}_${Math.random().toString(36).slice(2, 8)}`,
    templateId: template.id,
    name: template.name,
    icon: template.icon,
    level,
    hp: derived.maxHp,
    maxHp: derived.maxHp,
    derived,
    tags: template.tags,
    isBoss: !!template.isBoss,
    isElite: !!template.isElite,
    buffs: [],
    alive: true,
    skills,
    loot: template.loot,
  };
}
```

### 2.4 calcDerivedStats 修改

在 `combat.ts` 中为 `calcDerivedStats` 添加 `applyLevelBonus` 参数：

```typescript
export function calcDerivedStats(
  base: PrimaryStats,
  equipment: (Equipment | null)[],
  level: number,
  applyLevelBonus = true,  // 新增：英雄=true，怪物=false
): DerivedStats {
  // ... 现有计算 ...

  // 等级加成（仅英雄）
  if (applyLevelBonus) {
    const levelBonus = 1 + (level - 1) * 0.05;
    derived.maxHp = Math.floor(derived.maxHp * levelBonus);
    // ...
  }

  return derived;
}
```

---

## 3. 大地区与关卡结构

### 3.1 区域定义 (`shared/src/constants/regions.ts`)

```typescript
import type { RegionDef } from '../types';

export const REGIONS: RegionDef[] = [
  {
    id: 'region_1',
    name: '史莱姆平原',
    desc: '新手冒险者的试炼之地，史莱姆成群出没。',
    theme: 'forest',
    levels: [
      // 1-1 ~ 1-4: 2波小怪 + 1波精英
      makeLevel('1-1', 'region_1', 1, 1, [
        { monsters: [{ templateId: 'slime_green', level: 1 }, { templateId: 'slime_green', level: 1 }] },
        { monsters: [{ templateId: 'slime_blue', level: 2 }] },
      ]),
      // 1-5: Boss单独战
      makeLevel('1-5', 'region_1', 5, 3, [
        { monsters: [{ templateId: 'slime_king', level: 3 }] },
      ]),
      // 1-6 ~ 1-9: 更高等级，类似模式
      // 1-10: Boss
    ],
  },
  // region_2: 骸骨墓地
  // region_3: 恶魔巢穴
];

// 辅助函数
function makeLevel(id, regionId, stageNum, recommendLevel, waves): LevelDef { ... }

// 便捷查询
export function getLevelById(id: string): LevelDef | undefined { ... }
export function getRegionByLevelId(levelId: string): RegionDef | undefined { ... }
export function getLevelDisplay(level: LevelDef): string {
  // 返回 '1-1' 格式
}
```

### 3.2 关卡解锁逻辑

- 区域内顺序解锁：通关 1-N 解锁 1-(N+1)
- 区域间顺序解锁：通关 1-10 解锁区域2
- 可重复挑战已通关关卡

---

## 4. 战斗状态机重构

### 4.1 初始化 (`initTurnState`)

```typescript
export function initTurnState(hero: Hero, level: LevelDef, waveIndex = 0): TurnState {
  const wave = level.waves[waveIndex];
  const heroDerived = calcHeroDerived(hero);

  // 从波次定义生成敌人实例
  const enemies: EnemyCombatState[] = wave.monsters.map(m => {
    const template = MONSTER_TEMPLATES[m.templateId];
    return scaleMonster(template, m.level);
  });

  // 先攻判定（取最快敌人比较）
  const fastestEnemySpeed = Math.max(...enemies.map(e => e.derived.speed));
  const heroFirst = heroDerived.speed >= fastestEnemySpeed
    ? Math.random() < 0.6
    : Math.random() < 0.4;

  return {
    phase: heroFirst ? 'player' : 'enemy',
    // ... 英雄状态 ...
    heroLevel: hero.level,
    enemies,
    currentEnemyIndex: 0,
    selectedTargetUid: null,
    targetingMode: false,
    pendingSkillId: null,
    waveIndex,
    totalWaves: level.waves.length,
    turnCount: 0,
    log: [],
    heroBuffs: [],
  };
}
```

### 4.2 回合流程

```
玩家阶段:
  1. processStartOfTurn(hero) — DOT/回复/控制检查
  2. 若被控制跳过 → 进入敌方阶段
  3. 玩家选择行动:
     a. 普攻 → 需选目标 → resolvePlayerAttack(targetUid)
     b. 技能 → 检查targeting:
        - self → 直接释放
        - auto_all → 直接释放，命中所有敌人
        - single/chain/multi → 进入选目标模式
     c. 防御 → heroDefending = true
     d. 逃跑 → 速度判定
  4. 检查所有敌人是否死亡 → 推进波次或胜利
  5. 进入敌方阶段

敌方阶段:
  1. 遍历所有存活敌人 (currentEnemyIndex 0 → enemies.length-1):
     a. processStartOfTurn(enemy) — DOT/回复/控制
     b. 若被控制跳过
     c. AI选择技能和目标
     d. resolveEnemyAction(enemy, skill, target)
     e. 检查英雄是否死亡 → 失败
  2. 所有敌人行动完毕 → 回到玩家阶段
  3. turnCount++, tickBuffs(hero), tickBuffs(allEnemies)
```

### 4.3 玩家行动解析 (`resolvePlayerAction`)

```typescript
function resolvePlayerAction(
  state: TurnState,
  hero: Hero,
  action: TurnAction,
  targetUid?: string,  // 新增：目标参数
): TurnLogEntry | null {
  switch (action.kind) {
    case 'attack': {
      const target = state.enemies.find(e => e.uid === targetUid && e.alive);
      if (!target) return null;
      // ... 计算伤害，扣除目标HP ...
      return logEntry;
    }
    case 'skill': {
      const skill = getEffectiveSkill(...);
      const target = state.enemies.find(e => e.uid === targetUid && e.alive);

      switch (skill.targeting) {
        case 'single':
          // 对 target 造成伤害
          break;
        case 'chain':
          // 对 target 造成伤害，然后按 chainSelection 选 N-1 个次要目标
          // 每个次要目标伤害 *= chainDecay
          break;
        case 'auto_all':
          // 对所有存活敌人造成伤害（每个 * multiTargetDamageRate）
          break;
        case 'self':
          // 施加 selfEffects
          break;
      }
      return logEntry;
    }
  }
}
```

### 4.4 敌方行动解析 (`resolveEnemyAction`)

```typescript
function resolveEnemyAction(
  state: TurnState,
  enemy: EnemyCombatState,
): TurnLogEntry | null {
  // AI选择技能
  const { skill } = selectMonsterSkill(enemy, state);

  // 怪物技能目标 = 英雄（单体/全体都是打英雄）
  const enemyEff = getEffectiveDerived(enemy.derived, enemy.buffs);
  const heroEff = getEffectiveDerived(state.heroDerived, state.heroBuffs);

  if (skill.damageMultiplier > 0) {
    // 伤害技能
    const instance = { category: 'physical', amount: enemyEff.physicalAttack * skill.damageMultiplier };
    const result = calcDamage(enemyEff, heroEff, instance, [], enemy.level, state.heroLevel);
    // ... 扣除英雄HP，应用护盾/减伤 ...
  }

  // 施加效果
  applyEnemyEffects(state, skill.effects || []);
  applyEnemySelfEffects(enemy, skill.selfEffects || []);

  return logEntry;
}
```

### 4.5 波次推进

```typescript
// 检查是否所有敌人死亡
function checkWaveClear(state: TurnState): boolean {
  return state.enemies.every(e => !e.alive);
}

// 推进到下一波
function advanceWave(state: TurnState, hero: Hero, level: LevelDef): TurnState {
  const nextWaveIndex = state.waveIndex + 1;
  if (nextWaveIndex >= state.totalWaves) {
    return { ...state, phase: 'win' };
  }
  // 保留英雄HP/怒气，生成新波次敌人
  const newTs = initTurnState(hero, level, nextWaveIndex);
  newTs.heroHp = Math.min(newTs.heroMaxHp, state.heroHp);
  newTs.heroRage = Math.min(newTs.heroMaxRage, state.heroRage);
  newTs.heroBuffs = state.heroBuffs; // buff跨波次保留
  newTs.log = state.log;
  return newTs;
}
```

---

## 5. 技能目标系统

### 5.1 现有技能重构

| 技能 | 原 targeting | 新 targeting | 说明 |
|------|-------------|-------------|------|
| 重击 | 无 | `single` | 单体180%伤害 |
| 盾击 | 无 | `single` | 单体130%+击晕 |
| 蓄力一击 | 无 | `single` | 蓄力+单体250% |
| 裂伤斩 | 无 | `single` | 单体110%+流血 |
| 旋风斩 | multi_target(旧) | `auto_all` | 全体100%伤害，每个目标伤害衰减 |
| 烈焰斩 | 无 | `single` | 单体140%+燃烧 |
| 雷霆突袭 | 无 | `single` | 单体180%+麻痹 |
| 嘲讽 | 无 | `self` | 自身减伤+回怒 |
| 钢铁壁垒 | 无 | `self` | 自身减伤+护盾 |
| 不屈意志 | 无 | `self` | 自身不屈 |

### 5.2 新增技能

```typescript
// 飞盾 — 连锁技能
{
  id: 'skill_shield_throw',
  name: '飞盾',
  type: SkillType.Active,
  description: '投掷盾牌造成 150% 伤害，连锁波及 2 个额外目标（每个 70% 伤害）',
  damageMultiplier: 1.5,
  rageCost: 35,
  targeting: 'chain',
  targetCount: 3,        // 总目标数（含主目标）
  chainSelection: 'random',
  chainDecay: 0.7,       // 每次波及伤害衰减
  icon: '🛡️',
  effectName: 'circle_01.png',
},

// 横扫 — AOE技能
{
  id: 'skill_sweep',
  name: '横扫',
  type: SkillType.Active,
  description: '横扫所有敌人，每个造成 80% 伤害',
  damageMultiplier: 0.8,
  rageCost: 40,
  targeting: 'auto_all',
  icon: '🌀',
  effectName: 'slash_02.png',
},
```

### 5.3 目标选择流程（客户端）

```
1. 玩家点击技能按钮
2. 检查怒气是否足够
3. 检查 targeting:
   - 'self' → 直接释放，调用 playerAction({kind:'skill', skillId})
   - 'auto_all' → 直接释放
   - 'single' → 进入选目标模式：
     a. 设置 targetingMode=true, pendingSkillId=skill.id
     b. 敌人精灵高亮可选
     c. 玩家点击敌人 → playerAction({kind:'skill', skillId, targetUid})
     d. 或点击"取消"退出选目标模式
   - 'chain' → 同 single（选主目标，次要目标自动）
   - 'multi' → 进入多选模式：
     a. 显示"选择N个目标"
     b. 玩家点击N个敌人
     c. 确认 → playerAction({kind:'skill', skillId, targetUids})
4. 自动选择开关开启时：
   - single/chain → 自动选第一个存活敌人
   - multi → 自动选前N个存活敌人
   - self/auto_all → 不受影响
```

---

## 6. 怪物效用评分AI (`shared/src/logic/monsterAI.ts`)

```typescript
import type { EnemyCombatState, TurnState, Skill } from '../types';

interface SkillScore {
  skill: Skill;
  score: number;
}

export function selectMonsterSkill(
  enemy: EnemyCombatState,
  state: TurnState,
): { skill: Skill } {
  const aliveSkills = enemy.skills.filter(s => s);
  if (aliveSkills.length === 0) {
    // 无技能时使用默认攻击（100%物理伤害）
    return { skill: DEFAULT_MONSTER_ATTACK };
  }

  const scores: SkillScore[] = aliveSkills.map(skill => ({
    skill,
    score: evaluateUtility(skill, enemy, state),
  }));

  // 加入随机性（±15%）
  for (const s of scores) {
    s.score *= 0.85 + Math.random() * 0.3;
  }

  scores.sort((a, b) => b.score - a.score);
  return { skill: scores[0].skill };
}

function evaluateUtility(skill: Skill, enemy: EnemyCombatState, state: TurnState): number {
  let score = 0;
  const hpRatio = enemy.hp / enemy.maxHp;

  // 伤害技能：按预期伤害占英雄HP比例评分
  if (skill.damageMultiplier > 0) {
    const expectedDmg = enemy.derived.physicalAttack * skill.damageMultiplier;
    const dmgRatio = expectedDmg / state.heroMaxHp;
    score += dmgRatio * 100;

    // AOE技能打多目标时加分
    if (skill.targeting === 'auto_all') {
      const aliveCount = 1; // 英雄只有1个
      score *= 1; // 对英雄来说AOE=单体
    }
  }

  // 治疗技能：HP越低评分越高
  if (skill.selfEffects?.some(e => e.kind === 'heal')) {
    const healValue = skill.selfEffects.find(e => e.kind === 'heal')?.value ?? 0;
    score += healValue * (1 - hpRatio) * 200;
    // 满血时不治疗
    if (hpRatio > 0.8) score *= 0.1;
  }

  // 防御技能：低血量时优先
  if (skill.selfEffects?.some(e => ['shield', 'def_up'].includes(e.kind))) {
    if (hpRatio < 0.5) {
      score += (0.5 - hpRatio) * 150;
    } else {
      score *= 0.2;
    }
  }

  // 控制技能：按概率评分
  if (skill.effects?.some(e => ['stun', 'paralyse', 'freeze'].includes(e.kind))) {
    score += 25;
    // 英雄高血量时控制更有价值（防止反击）
    if (state.heroHp / state.heroMaxHp > 0.5) score += 10;
  }

  // 减益技能：中等优先级
  if (skill.effects?.some(e => ['def_down', 'atk_down', 'bleed', 'burn', 'poison'].includes(e.kind))) {
    score += 20;
  }

  return score;
}
```

---

## 7. 等级压制系统

### 7.1 常量 (`balance.ts`)

```typescript
// 等级压制
LEVEL_SUPPRESSION_RATE: 0.07,   // 每级差 ±7% 伤害
LEVEL_SUPPRESSION_MIN: 0.15,    // 最低造成 15% 伤害
LEVEL_SUPPRESSION_MAX: 3.0,     // 最高造成 300% 伤害
```

### 7.2 calcDamage 修改 (`combat.ts`)

```typescript
export function calcDamage(
  attacker: DerivedStats,
  defender: DerivedStats,
  instance: DamageInstance,
  defenderTags?: string[],
  attackerLevel?: number,
  defenderLevel?: number,
): DamageResult {
  // ... 现有命中/暴击/格挡/减伤/穿透/元素计算 ...
  let amount = /* 现有计算结果 */;

  // 等级压制
  if (attackerLevel != null && defenderLevel != null) {
    const levelDiff = attackerLevel - defenderLevel;
    const suppressionMult = 1 + levelDiff * GAME_BALANCE.LEVEL_SUPPRESSION_RATE;
    const clamped = Math.max(
      GAME_BALANCE.LEVEL_SUPPRESSION_MIN,
      Math.min(GAME_BALANCE.LEVEL_SUPPRESSION_MAX, suppressionMult)
    );
    amount = Math.floor(amount * clamped);
  }

  return { amount: Math.floor(amount), isCrit, isBlocked, isHit: true };
}
```

### 7.3 等级压制效果示例

| 等级差 | 倍率 | 效果 |
|--------|------|------|
| +10 | 1.70 | 高10级打人+70%伤害 |
| +5 | 1.35 | 高5级打人+35%伤害 |
| 0 | 1.00 | 同级正常伤害 |
| -5 | 0.65 | 低5级打人-35%伤害 |
| -10 | 0.30 | 低10级打人-70%伤害 |
| -15+ | 0.15 | 最低15%伤害 |

---

## 8. UI 变更

### 8.1 冒险地图 (`AdventureMap.tsx`)

```
┌─────────────────────────────────────┐
│  [史莱姆平原] [骸骨墓地] [恶魔巢穴]  │  ← 区域标签
├─────────────────────────────────────┤
│                                     │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐          │
│  │1-1│ │1-2│ │1-3│ │1-4│ │1-5│      │  ← 关卡网格
│  │ ✓ │ │ ✓ │ │ ✓ │ │ ● │ │🔒│       │  ✓=通关 ●=可挑战 🔒=锁定
│  └──┘ └──┘ └──┘ └──┘ └──┘          │
│                                     │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐          │
│  │1-6│ │1-7│ │1-8│ │1-9│ │1-10│     │
│  │🔒 │ │🔒 │ │🔒 │ │🔒 │ │🔒 │       │
│  └──┘ └──┘ └──┘ └──┘ └──┘          │
│                                     │
│  hover: 推荐Lv.3 / 2波+1精英 / 💎10 │
└─────────────────────────────────────┘
```

- 区域标签切换显示对应关卡
- 锁定区域标签显示🔒且不可点击
- 关卡节点显示 stageNum (1-1 格式)
- hover 显示推荐等级、波次组成、首通奖励

### 8.2 战斗场景 (`BattleScene.ts`)

```
┌──────────────────────────────────────┐
│                                      │
│  [英雄]         [敌1] [敌2] [敌3]    │
│   ⚔️             👾    👾    👗      │
│  HP█████░       HP██░  HP████  HP███ │
│  Lv.5           Lv.3   Lv.3   Lv.4   │
│                                      │
│  ┌─ 目标选择 ──────────────────────┐ │
│  │ 点击敌人选择目标  [自动选择 ON] │ │
│  └─────────────────────────────────┘ │
│                                      │
│  [重击30怒] [盾击25怒] [飞盾35怒]    │
│  [裂伤斩20怒] [旋风斩50怒] [横扫40怒]│
│  [防御] [逃跑]                       │
└──────────────────────────────────────┘
```

- 多个敌人精灵横向排列在右侧
- 每个敌人显示：图标、名称、等级、HP条、buff图标
- 选目标模式：敌人精灵高亮脉冲，可点击
- 选中目标：边框高亮（金色）
- 自动选择开关：UI右上角toggle

### 8.3 TurnBattleUI 目标选择状态

```typescript
// 新增状态
const [targetingMode, setTargetingMode] = useState(false);
const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
const [autoTarget, setAutoTarget] = useState(false);

// 点击技能
function handleSkillClick(skill: Skill) {
  if (autoTarget) {
    // 自动选目标直接释放
    const target = state.enemies.find(e => e.alive);
    playerAction({ kind: 'skill', skillId: skill.id, targetUid: target?.uid });
    return;
  }
  switch (skill.targeting) {
    case 'self':
    case 'auto_all':
      playerAction({ kind: 'skill', skillId: skill.id });
      break;
    case 'single':
    case 'chain':
      setTargetingMode(true);
      setPendingSkill(skill);
      setSelectedTargets([]);
      break;
    case 'multi':
      setTargetingMode(true);
      setPendingSkill(skill);
      setSelectedTargets([]);
      break;
  }
}

// 点击敌人
function handleEnemyClick(uid: string) {
  if (!targetingMode || !pendingSkill) return;
  if (pendingSkill.targeting === 'single' || pendingSkill.targeting === 'chain') {
    playerAction({ kind: 'skill', skillId: pendingSkill.id, targetUid: uid });
    setTargetingMode(false);
    setPendingSkill(null);
  } else if (pendingSkill.targeting === 'multi') {
    const newSelection = [...selectedTargets, uid];
    if (newSelection.length >= pendingSkill.targetCount) {
      playerAction({ kind: 'skill', skillId: pendingSkill.id, targetUids: newSelection });
      setTargetingMode(false);
      setPendingSkill(null);
    } else {
      setSelectedTargets(newSelection);
    }
  }
}
```

---

## 9. TurnAction 扩展

```typescript
export interface TurnAction {
  kind: TurnActionKind;
  skillId?: string;
  targetUid?: string;     // 单体/连锁的主目标
  targetUids?: string[];  // 多选模式的多个目标
}
```

---

## 10. 存档与清理

### 10.1 存档重置

项目处于开发阶段，无旧存档。`gameStore.ts` 中的 save/load 逻辑更新为新的关卡进度结构：

```typescript
// 旧: levelProgress 按 levelId 索引
// 新: levelProgress 按 '1-1', '1-2' 等新ID索引

// 删除 stage/highestStage 字段（遗留，不再使用）
```

### 10.2 遗留清理

- 删除 `server/src/services/templates.ts`（`MONSTER_TEMPLATES`, `getMonsterForStage`）
- 删除 `Monster` 接口（由 `EnemyCombatState` 替代）
- 删除 `MonsterDef` 接口（由 `MonsterTemplate` + `WaveDef` 替代）
- 删除 `levels.ts`（由 `regions.ts` 替代，保留 re-export 兼容）
- 删除 `simulateCombat` 函数（基于旧 Monster 类型，不再需要）

---

## 11. 关键权衡

### 11.1 怪物技能无资源限制 + 效用AI
- **风险**: 多怪物时英雄每轮承受多次技能攻击，可能过于压迫
- **缓解**: 怪物技能伤害倍率较低（0.8~2.0），英雄HP/防御相对较高；效用AI会根据情况选择非伤害技能（治疗/防御），不会每回合全输出
- **可调**: AI评分权重和随机性可后续调优

### 11.2 逐属性线性成长 vs 指数成长
- **选择理由**: 线性成长更易理解和调优，不同怪物可有不同成长曲线
- **代价**: 高等级时成长可能不够陡峭（依赖等级压制系统补充）
- **缓解**: 等级压制伤害倍率提供额外的等级差距感受

### 11.3 TurnState 数组化重构
- **影响**: 几乎所有战斗逻辑函数需要修改（runTurn, runEnemyTurn, resolvePlayerAction, resolveEnemyAction 等）
- **策略**: 保持纯函数状态机模式，逐一修改；先改类型和初始化，再改行动解析，最后改UI
- **风险控制**: 每步可独立测试（类型检查 + 战斗流程验证）

### 11.4 calcDerivedStats 的 applyLevelBonus 参数
- **选择**: 怪物不应用5%等级加成（statGrowth已覆盖缩放），英雄保留
- **理由**: 避免双重缩放导致怪物过强；设计师通过 statGrowth 精确控制怪物成长曲线
