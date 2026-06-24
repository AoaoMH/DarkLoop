# 回合制战斗与关卡波次引擎 - 技术设计

## 架构与边界

```
packages/client/src
  ├ game/
  │  ├ config.ts              (不改)
  │  ├ scenes/BootScene.ts    (不改，继续加载现有 5 张 png)
  │  ├ scenes/BattleScene.ts  (重写：回合制状态机驱动，subscribe store)
  │  └ battleBridge.ts        (新建：Phaser.Events.EventEmitter 单例)
  ├ components/
  │  ├ GameCanvas.tsx         (不改)
  │  ├ TurnBattleUI.tsx       (新建：DOM 覆盖层，行动栏+技能+Step+结算面板)
  │  └ AdventureMap.tsx       (微调：hover 按钮 onClick 绑定)
  ├ stores/gameStore.ts       (微调：flee 时也清 battleReward)
  └ App.tsx                   (微调：isBattling 时叠加 TurnBattleUI)
```

## 协调机制（核心）

**单向数据流**：
```
DOM TurnBattleUI 按钮
  → useGameStore.getState().playerAction(action)
  → store 调 runTurn 更新 turnState
  → BattleScene (create 时 useGameStore.subscribe) 监听 turnState 变化
  → 读最新 log entry 播对应特效
  → 特效完成:
      phase==='anim'  → useGameStore.getState().advanceWave()  (自动推进下一波)
      phase==='win'   → battleBridge.emit('battle-end', 'win')
      phase==='lose'  → battleBridge.emit('battle-end', 'lose')
      phase==='flee'  → battleBridge.emit('battle-end', 'flee')
  → TurnBattleUI 监听 battleBridge 'battle-end' 显示结算面板
```

**为何不用 Phaser registry**：zustand subscribe 是框架无关的纯函数订阅，BattleScene 可直接 import，清理在 `shutdown` 时退订。bridge 只承担 Phaser→DOM 通知，避免双向耦合。

**为何 DOM 不直接监听 turnState.phase**：DOM 行动按钮本就通过 store 驱动，phase=player 时启用按钮、其他相位禁用。结算面板用 bridge 事件触发，避免在 DOM 里重复 subscribe phase 判断。

## BattleScene 状态机驱动

### subscribe 设计
```ts
create() {
  this.renderScene();          // 初始渲染（读 getState().turnState）
  this.lastLogLen = 0;
  this.unsub = useGameStore.subscribe((s) => s.turnState, (ts) => this.onTurnStateChanged(ts));
}
```
> Zustand v5 `subscribe` with selector 需要 `subscribeWithSelector` middleware，或直接全量 subscribe 在回调里比较。本项目用全量 subscribe + 内部比较 lastLogLen，避免引入 middleware。

### onTurnStateChanged(ts)
1. 若 ts===null（战斗结束）→ scene 静默
2. 若 phase==='anim' → 播波次过渡（敌人淡出→新敌人淡入）→ 完成调 advanceWave
3. 若 phase==='win'/'lose'/'flee' → 播终局特效（胜利光环/失败暗化）→ emit bridge
4. 否则（player/enemy）→ 读 log[lastLogLen:] 新增条目，按 actor+action 顺序播特效：
   - hero attack: hero tween 前冲→命中→回位 + 敌人闪白 + 伤害飘字
   - hero skill: 技能粒子 + 敌人受击 + 伤害飘字（crit 加大加红）
   - hero defend: hero 盾牌图标闪现
   - hero flee: 闪现烟雾
   - enemy attack: enemy tween 前冲→命中→回位 + hero 闪红 + 伤害飘字
   - enemy skill: 红色粒子爆发 + hero 受击
5. 更新血条/怒气条/Step
6. lastLogLen = ts.log.length

### 特效完成回调链
用 async/await + Phaser tween promise 化：
```ts
private tweenPromise(cfg) { return new Promise(res => this.tweens.add({ ...cfg, onComplete: res })); }
```
依次播放 player action → enemy action，全部完成后检查 phase 决定下一步。

## TurnBattleUI 组件结构

```
TurnBattleUI
  ├ 顶部 StepBar        (wave 1/4 ... 4/4，高亮当前)
  ├ 中部 (透明，让 Phaser 画面可见)
  └ 底部 ActionBar
      ├ 攻击 / 防御 / 逃跑 按钮
      ├ 技能按钮列表 (WARRIOR_SKILLS 过滤 Active，显示 icon+name+rageCost)
      │   └ disabled when rageCost > heroRage
      └ phase!=='player' 时全部 disabled
  └ 结算面板 BattleResultPanel (conditional)
      ├ win: 奖励列表 + 装备掉落 + "领取奖励"
      ├ lose: "战斗失败" + "返回地图"
      └ flee: "已逃跑" + "返回地图"
```

### 按钮交互
- 点击 → `playerAction({kind:'attack'})` / `{kind:'skill', skillId}` / `{kind:'defend'}` / `{kind:'flee'}`
- 点击后按钮禁用，等待 phase 回到 player（store 自动推进）才重新启用

## 数据流：结算

```
win → BattleScene emit bridge('battle-end','win')
   → TurnBattleUI 显示 BattleResultPanel
   → 读 useGameStore.battleReward (calcBattleReward 产出)
   → 显示 resources(gold/exp/gems/badge) + equipment[]
   → 点"领取奖励" → claimBattleReward() → store 更新 resources/hero/levelProgress/inventory, isBattling=false
   → App.tsx isBattling=false → 回到 AdventureMap
```

## 兼容性

- `gameStore.playerAction` flee 分支当前 `return { turnState: next, isBattling: false }`，会导致 TurnBattleUI 卸载但 BattleScene 还在。修正：flee 也走 bridge 通知，保持 isBattling=true 直到用户点"返回地图"才 endBattle。
- `AdventureMap` hover 按钮无 onClick → 补 `onClick={() => onStartLevel(level.id)}`，并阻止节点 click 重复触发（改为仅按钮触发开始，节点 click 无操作或聚焦）。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| BattleScene subscribe 未退订导致内存泄漏 | shutdown 生命周期调 this.unsub() |
| 特效未播完 phase 已变 → 动画错乱 | 特效期间设 isAnimating 锁，subscribe 回调里若 isAnimating 则排队，播完处理 |
| emoji 在 Phaser Text 渲染尺寸不一 | 固定 fontSize + setOrigin，Boss 额外 scale 1.5 |
| 怪物精灵只有 slime/demon → 用 emoji 统一 | 全部用 Text(emoji)，不依赖 png |
| waveIndex 推进时旧敌人残留 | anim 阶段先淡出旧敌人再淡入新敌人 |
