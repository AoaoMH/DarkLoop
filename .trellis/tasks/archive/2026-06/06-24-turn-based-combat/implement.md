# 回合制战斗与关卡波次引擎 - 执行计划

## 实现顺序

### Step 1: battleBridge.ts 新建
- 新建 `src/game/battleBridge.ts`：导出 `Phaser.Events.EventEmitter` 单例
- 事件：`'battle-end'` (payload: 'win'|'lose'|'flee')
- 验证：typecheck

### Step 2: BattleScene.ts 重写
- 移除 `time.addEvent` 自动循环、`performAttack`/`resetMonster`/`onMonsterDefeated` 旧逻辑
- create: 渲染背景/地面/英雄(hero_warrior.png)/敌人(emoji Text)/血条/怒气条/Step/名称
- subscribe `useGameStore`：onTurnStateChanged 按 log 增量播特效
- 特效：tweenPromise 化，hero/enemy 攻击位移、伤害飘字、受击闪色、技能粒子、防御盾、逃跑烟雾
- phase 处理：anim→过渡→advanceWave；win/lose/flee→终局→emit bridge
- shutdown: unsub + bridge off
- 验证：typecheck + build

### Step 3: TurnBattleUI.tsx 新建
- 顶部 StepBar（waveIndex+1 / totalWaves）
- 底部 ActionBar：攻击/防御/逃跑 + 技能列表（Active 过滤，怒气门控，phase 门控）
- 结算面板 BattleResultPanel：win/lose/flee 三态
- 监听 bridge 'battle-end' 切换结算面板
- win 面板读 battleReward 显示 resources + equipment（RARITY_COLORS 边框）
- 按钮调 store.playerAction / claimBattleReward / endBattle
- 验证：typecheck

### Step 4: App.tsx + AdventureMap.tsx 微调
- App.tsx：isBattling 时 `<GameCanvas /><TurnBattleUI />` 叠加（GameCanvas 占位，TurnBattleUI absolute 覆盖）
- AdventureMap.tsx：hover 按钮 `onClick={() => onStartLevel(level.id)}`，节点本身 onClick 改为切换 hover 或无操作（避免重复触发）
- 验证：typecheck

### Step 5: gameStore.ts 微调
- playerAction flee 分支：不立即 isBattling=false，保留 isBattling 让 TurnBattleUI 显示逃跑面板，由 endBattle 收尾
- 验证：typecheck

### Step 6: CSS 补充
- global.css 加 .turn-battle-ui / .step-bar / .action-bar / .skill-btn / .battle-result 等样式
- 验证：build

### Step 7: 全量验证
- `pnpm --filter @darkloop/shared build`
- `pnpm typecheck`
- `pnpm --filter @darkloop/client build`
- 手动 `pnpm dev` 走完整闭环

## 验证命令

```bash
pnpm typecheck
pnpm --filter @darkloop/client build
pnpm dev
```

## 回滚点

| Step | 回滚方式 |
|------|---------|
| Step2 BattleScene 重写 | git checkout 旧 BattleScene（自动战斗版） |
| Step3-5 UI/store | 各自独立改动，可单独 revert |

## task.py start 前检查

- [x] prd.md 完成
- [x] design.md 完成
- [x] implement.md 完成
- [ ] 用户审阅（用户已授权"开始吧"，规划沿用父任务已确认决策）
