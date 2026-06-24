# 冒险玩法 v1 - 技术设计

## 架构与边界

保持现有 monorepo 三包职责不变，改动集中在各包内部：

```
packages/shared   ← 数据契约层（类型/常量/关卡定义/回合制纯逻辑）— 子任务 data-systems-base
  ├ types:        Rarity 扩7档 / Resource / Talent / Level / Turn 战斗类型
  ├ constants:    RARITY_COLORS·WEIGHTS 重做 / RESOURCES / TALENT_TREES / LEVELS / WARRIOR_SKILLS
  └ logic:        turnBasedCombat 纯函数状态机（替代 simulateCombat）
packages/client   ← UI 与状态层 — 子任务 ui-layout-nav + turn-based-combat
  ├ App.tsx:      中间区按 activeMenu 路由（AdventureMap/Inventory/Talent/锁定态）
  ├ components:   ResourceBar(替代 ActionBar) / AdventureMap / LevelHover / TurnBattle / TalentPanel
  ├ stores:       gameStore 扩展（resources/talents/levelProgress/battle 状态）
  └ game:         移除 BattleScene 自动战斗（见权衡 §技术选型）
packages/server   ← 本版不动（客户端 localStorage 存档，服务端预留）
```

## 跨子任务数据契约（data-systems-base 产出 → 其他子任务消费）

data-systems-base 必须先交付以下 shared 导出，其他子任务才能开工：

| 导出 | 类型 | 消费方 |
|------|------|--------|
| `Rarity` 枚举 7 档 + `RARITY_COLORS`/`RARITY_WEIGHTS` | 常量 | ui-layout-nav(装备颜色)、turn-based-combat(掉落) |
| `ResourceKind` + `RESOURCES` 配置 | 类型+常量 | ui-layout-nav(底部资源栏) |
| `TalentTree`/`TalentNode` + `WARRIOR_TALENT_TREE` | 类型+常量 | ui-layout-nav(天赋盘 UI) |
| `Skill`(加 `rageCost`/`branch?`) + `WARRIOR_SKILLS` | 类型+常量 | turn-based-combat(技能) |
| `LevelDef`/`WaveDef`/`MonsterDef` + `LEVELS[3]` | 类型+常量 | ui-layout-nav(地图)、turn-based-combat(波次) |
| `TurnState`/`TurnAction` + `runTurn()` 纯函数 | 类型+逻辑 | turn-based-combat(战斗引擎) |
| `Hero` 扩 `talentPoints`/`spentPoints`/`learnedTalents` | 类型 | 全部 |

## 数据结构设计

### 稀有度 7 档（重写 equipment.ts）
```ts
enum Rarity { Common, Fine, Rare, Epic, Legendary, Mythic, Apex }
RARITY_COLORS  = { Common:'#e0e0e0', Fine:'#1eff00', Rare:'#0070dd', Epic:'#a335ee', Legendary:'#ff8000', Mythic:'#ff3b3b', Apex:'线性渐变炫彩' }
RARITY_WEIGHTS = { Common:50, Fine:30, Rare:14, Epic:5, Legendary:1, Mythic:0, Apex:0 } // 神话/至臻不产出
```
> 命名映射：普通Common/优秀Fine/稀有Rare/史诗Epic/传说Legendary/神话Mythic/至臻Apex。`getAffixCount` 扩展到 7 档。

### 资源货币（新增 types + constants）
```ts
enum ResourceKind { Gold, Exp, Gems, Badge }
interface Resources { gold:number; exp:number; gems:number; badge:number }
```
产出：战斗结算(gold/exp)、关卡首通(gems/badge)。消耗：v1 仅预留（勋章解锁难度=消耗badge）。

### 天赋盘（路径式·3分支）
```ts
interface TalentNode { id; branch:'berserk'|'bulwark'|'warcry'; tier:number; name; desc; effects:Partial<HeroStats>|modifier; requires:string[]; maxRank:number }
interface TalentTree { warrior: { berserk:TalentNode[]; bulwark:TalentNode[]; warcry:TalentNode[] } }
```
点数：`hero.talentPoints`（= level-1 初始0），`hero.learnedTalents:Record<nodeId,rank>`。重置=清空 learnedTalents 还回点数，免费。

### 战士技能（怒气消耗）
```ts
interface Skill { id; name; branch?; rageCost:number; type:'active'|'passive'; effect:DamageFn|BuffFn; cooldown?:number }
```
怒气：战斗内 `TurnState.heroRage`，攻击+10/受击+15/防御+20，上限100。

### 关卡定义
```ts
interface MonsterDef { id; name; level; hp; atk; def; speed; icon; loot: LootEntry[]; isBoss?:boolean }
interface WaveDef { monsters: MonsterDef[] }
interface LevelDef { id; name; desc; difficulty; waves: WaveDef[]; recommendLevel; firstClearReward:Partial<Resources> }
```

### 关卡数值表（平缓曲线，基于 balance.ts）

| 关卡 | 主题 | 小怪Lv | boss Lv | 小怪HP | bossHP | 小怪ATK | bossATK | 首通奖励 |
|------|------|--------|---------|--------|--------|---------|---------|----------|
| 1 | 史莱姆平原 | 1 | 2 | 30 | 80 | 6 | 10 | 10钻+1勋章 |
| 2 | 骸骨墓地 | 3 | 4 | 60 | 150 | 12 | 18 | 20钻+1勋章 |
| 3 | 恶魔巢穴 | 5 | 7 | 110 | 280 | 20 | 30 | 30钻+1勋章 |

每关 4 波：wave1-3 小怪（同主题），wave4 boss。HP=BASE_HP+vit*10 简化。ATK=BASE_ATTACK+str*0.5。

## 回合制战斗状态机（替代 simulateCombat）

```
TurnState { phase:'player'|'enemy'|'anim'|'win'|'lose'; heroRage; heroHp; enemyHp; log[]; waveIndex; turnCount }
runTurn(state, action): newState   ← 纯函数，可被 store 调用
```
流程：player 选 action → runTurn 结算 → phase=enemy → AI 选 action → runTurn → phase=player → 循环。敌人死 → 下一波 / win。英雄死 → lose。

AI 策略：怒气≥技能cost则用技能，否则攻击。速度高者先手（首回合 phase 由 speed 决定）。

## 技术选型权衡

### 战斗渲染：Phaser 画面 + DOM 行动 UI 覆盖层（已确认）
**保留 Phaser `BattleScene`，重写为回合制状态机驱动**（移除 `time.addEvent` 自动循环）。理由：
- 回合制是离散状态机，但技能特效是游戏核心体验，Phaser 的 tween/粒子/飘字/精灵动画表现力远超 CSS
- 复用现有 `GameCanvas` + `BootScene` 资源加载基建，不废弃 Phaser
- 架构延续现有 `GameCanvas` + `InventoryPanel` overlay 模式
- 分层：
  - 战斗画面 = Phaser BattleScene（精灵站位、血条/怒气条、攻击位移 tween、技能粒子、伤害飘字、受击闪红）
  - 行动 UI = DOM 覆盖层（攻击/技能/防御/逃跑按钮、技能列表、波次 Step 顶部条）
  - 战斗逻辑 = shared `runTurn` 纯函数（不变）
  - 协调 = Phaser Eventemitter（DOM 按钮→emit→Phaser 播特效→回调 store 结算）

### 中间区路由：条件渲染 vs 路由库
**选条件渲染**（按 `activeMenu` switch）。理由：菜单项少且固定，无需引入 react-router，App.tsx 内 switch 即可。

### 存档兼容
`PlayerSave` 加 `version:2`，新增 `resources`/`talentPoints`/`learnedTalents`/`levelProgress`。`loadGame` 检测版本降级兼容。

## 兼容性与迁移

| 现有代码 | 改动 |
|---------|------|
| `shared/types` Rarity 5→7档 | 加 Mythic/Apex，旧名 Common/Magic/Rare/Epic/Legendary → 重命名 Magic为Fine |
| `shared/constants/equipment` | 重写 RARITY_COLORS/WEIGHTS，EQUIP_TEMPLATES 保留扩展 |
| `shared/logic/combat` simulateCombat | 保留(离线预留)，新增 turnBasedCombat 模块 |
| `client/App.tsx` | 中间区 switch activeMenu，冒险分支挂 GameCanvas+TurnBattleUI overlay |
| `client/components/ActionBar` | 删除 → 新建 ResourceBar（底部资源）+ TurnBattleUI（战斗行动覆盖层） |
| `client/components/GameCanvas` | 保留，BattleScene 改为回合制状态机驱动 |
| `client/game/scenes/BattleScene` | 重写：移除自动循环，改按 turn 状态推进，接 runTurn + 播特效 |
| `client/stores/gameStore` | 扩展 resources/talent/battle 切片 |

## 风险与回滚

- **风险1**：Rarity 重命名（Magic→Fine）影响引用。缓解：全量 grep 替换，typecheck 兜底。
- **风险2**：Phaser 移除后素材加载链断裂。缓解：BootScene 资源加载迁移到 React（emoji/icon 即可，v1 不依赖精灵图）。
- **回滚点**：每个子任务独立 commit，data-systems-base 先合并验证 typecheck，再进 UI/战斗子任务。
