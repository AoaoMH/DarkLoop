# 回合制战斗与关卡波次引擎

## Goal

重写 Phaser `BattleScene` 为回合制状态机驱动的战斗画面，叠加 DOM 行动 UI 覆盖层，打通"冒险→选关→4 波战斗（3 小怪 + 1 Boss）→结算奖励→资源到账"完整闭环。战斗不再是自动循环，由玩家逐回合选择行动。

## Confirmed Facts（来自阶段1+2 已交付产物）

- shared 层已交付：`TurnState`/`TurnAction`/`runTurn` 纯函数（`turnBasedCombat.ts`）、`LEVELS[3]`（每关 4 波）、`WARRIOR_SKILLS`（4 主动 + 2 被动，怒气消耗）、`initTurnState`/`calcBattleReward`/`advanceWave` 支持。
- `gameStore` 已有：`startBattle(levelId)`→`initTurnState`、`playerAction(action)`→`runTurn`（处理 win/lose/flee）、`advanceWave()`→下一波 `initTurnState`、`claimBattleReward()`→发奖励+升级+得天赋点。
- `App.tsx` 已在 `isBattling` 时渲染 `GameCanvas`，但无 overlay。
- Phaser 配置：800×600，scene=[BootScene, BattleScene]，素材仅 hero_warrior/monster_slime/monster_demon/item_potion/tilemap 5 张 png。
- 关卡怪物 icon 已是 emoji（🟢💀👑☠️👺😈），可用 Phaser Text 渲染，无需为每怪做精灵图。

## Requirements

- R1 重写 `BattleScene.ts`：移除 `time.addEvent` 自动循环，改为订阅 `gameStore.turnState` 变化，按最新 log entry 播放特效（攻击位移 tween、伤害飘字、受击闪红、技能粒子、血条/怒气条更新）。
- R2 英雄用 `hero_warrior.png` 精灵；怪物用 emoji Text 渲染（读 `enemyIcon`），Boss 体型放大 + 红色描边。
- R3 战斗画面渲染：英雄左 / 敌人右站位、双血条 + 英雄怒气条、波次 Step 顶部条（waveIndex+1 / totalWaves）、敌人名称 + Boss 标识。
- R4 新建 `TurnBattleUI.tsx` DOM 覆盖层：底部行动栏（攻击/防御/逃跑 + 技能按钮列表），技能按钮显示怒气消耗，怒气不足或被动技能禁用。
- R5 Phaser↔DOM 协调：新建 `battleBridge.ts`（`Phaser.Events.EventEmitter` 单例）。DOM 按钮→`store.playerAction`→store 更新 turnState→BattleScene subscribe 播特效→特效完成后若 phase=anim 自动调 `advanceWave`，若 win/lose 通过 bridge 通知 DOM 显示结算。
- R6 结算面板（DOM）：win 显示奖励（gold/exp/gems/badge + 装备掉落列表，装备按 RARITY_COLORS 边框）+ "领取奖励"按钮→`claimBattleReward`；lose 显示"战斗失败"+ "返回"按钮→`endBattle`；flee 直接 `endBattle` 回地图。
- R7 `App.tsx`：`isBattling` 时 `GameCanvas` + `TurnBattleUI` 叠加渲染（GameCanvas 占位，TurnBattleUI absolute 覆盖）。
- R8 `AdventureMap.tsx`：hover 浮窗"开始战斗"按钮绑定 `onStartLevel`（当前按钮无 onClick）。
- R9 战斗中途退出（flee/lose）不发放奖励；仅 win 且 `claimBattleReward` 才入账。
- R10 怪物精灵沿用 emoji 方案，不新增素材文件。

## Acceptance Criteria

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm --filter @darkloop/client build` 通过
- [ ] 冒险→选关→悬浮描述→开始战斗 →进入 Phaser 战斗画面
- [ ] 顶部 Step 显示 1/4 → 4/4 推进
- [ ] 战斗无自动攻击，玩家点攻击/技能/防御/逃跑才推进回合
- [ ] 技能按钮怒气不足时禁用，被动技能不显示在行动栏
- [ ] 击败一波小怪后过渡到下一波，第 4 波为 Boss
- [ ] 胜利显示结算面板，装备按稀有度配色，领取后资源到账、经验升级、天赋点增加
- [ ] 失败/逃跑返回地图，无奖励
- [ ] 神话/至臻装备不产出（RARITY_WEIGHTS=0 已在阶段1保证）

## Out of Scope

- 战斗中途存档恢复（v1 退出即放弃战斗）
- 道具/药水使用（后续迭代）
- 自动战斗（后续迭代）
- 技能 cooldown（当前技能 cooldown=0，仅怒气门控）
- 多怪同波（当前每波 1 怪，数组预留）
- 新增精灵素材

## Notes

- 战斗逻辑全部走 shared `runTurn` 纯函数，BattleScene 只负责"读 state + 播特效"，不做规则计算。
- `battleBridge` 仅用于 Phaser→DOM 的单向通知（战斗结束），DOM→Phaser 走 store subscribe，保持单向数据流清晰。
