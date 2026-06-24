# 冒险玩法 v1 - 执行计划

## 实现顺序（子任务串行，因有数据依赖）

### 阶段1：data-systems-base（数据与系统基础）— 先启动
无依赖，是其他子任务的基础。产出 shared 层全部类型/常量/关卡定义/回合制纯逻辑。
1. Rarity 枚举 5→7档 + RARITY_COLORS/WEIGHTS 重写（equipment.ts）
2. ResourceKind/RESOURCES 新增（types + constants）
3. Hero 扩 talentPoints/spentPoints/learnedTalents（types）
4. TalentTree/TalentNode + WARRIOR_TALENT_TREE 常量（3分支各5-6节点）
5. Skill 加 rageCost/branch + WARRIOR_SKILLS 常量（3-4个主动+2被动）
6. LevelDef/WaveDef/MonsterDef + LEVELS[3] 常量（见 design.md 数值表）
7. turnBasedCombat 纯逻辑模块（runTurn 状态机 + AI + 怒气 + 掉落结算）
8. PlayerSave 扩 resources/talents/levelProgress + version:2
9. defaults.ts 更新 DEFAULT_HERO（天赋/技能/资源初始值）

**验证**：`pnpm --filter @darkloop/shared build` + `pnpm typecheck` 通过。

### 阶段2：ui-layout-nav（UI布局与导航）— 依赖阶段1
1. gameStore 扩展切片（resources/talent/levelProgress/battle 状态 + actions）
2. App.tsx 中间区 switch activeMenu 路由（AdventureMap/Inventory/Talent/锁定态）
3. 新建 ResourceBar 组件（替代 ActionBar，底部4资源显示）
4. 移除 GameCanvas/BattleScene/ActionBar 旧组件引用
5. 新建 AdventureMap（3关卡节点 + 路径线，锁定/解锁态）
6. 新建 LevelHover（关卡悬浮描述 + 开始战斗按钮）
7. SideMenu 改：仅冒险+背包可点，其余锁定态
8. 新建 TalentPanel（3分支路径式 UI + 点选 + 重置按钮）

**验证**：`pnpm typecheck` + 冒险→地图→选关→悬浮描述链路可点。

### 阶段3：turn-based-combat（回合制战斗）— 依赖阶段1+2
1. 重写 `BattleScene.ts`：移除 `time.addEvent` 自动循环，改为按 turn 状态推进，接 `runTurn` 纯函数
2. BattleScene 渲染：英雄/敌人精灵站位、血条+怒气条、攻击位移 tween、技能粒子、伤害飘字、受击闪红
3. 新建 `TurnBattleUI.tsx` DOM 覆盖层：攻击/技能/防御/逃跑按钮 + 技能列表 + 顶部 Step 进度条
4. Phaser↔DOM 协调：Eventemitter（按钮→emit→播特效→回调 store 结算）
5. 波次推进：3小怪波→boss波，波间过渡动画
6. 战斗结算面板（win/lose + 奖励：gold/exp/gems/badge + 装备掉落）
7. 首通判定 → 发放首通奖励 → 解锁下一关/难度
8. 战斗状态持久化（中途退出可恢复，可选）

**验证**：`pnpm typecheck` + 完整闭环：冒险→选关→4波战斗→结算→资源到账→天赋可用。

## 验证命令

```bash
# 每个子任务完成后
pnpm --filter @darkloop/shared build      # shared 编译
pnpm typecheck                            # 全量类型检查（client）
pnpm --filter @darkloop/client build      # client 构建
# 手动验证
pnpm dev                                  # 启动，浏览器走完整闭环
```

## 风险文件与回滚点

| 风险 | 文件 | 缓解 |
|------|------|------|
| Rarity 重命名 Magic→Fine 影响引用 | shared/types + equipment.ts + 所有引用 | 全量 grep 替换 + typecheck |
| Phaser 移除后 App.tsx 引用断裂 | App.tsx/GameCanvas/config.ts | 先注释引用再删文件 |
| simulateCombat 被其他地方引用 | gameStore/combat.ts | 保留 simulateCombat 不删，新增 turnBasedCombat |
| 存档版本不兼容 | gameStore.loadGame | version 检测 + 降级补默认值 |

## task.py start 前检查

- [x] 父任务 prd.md 完成（5 决策已澄清）
- [x] 父任务 design.md 完成（架构+契约+数值表+状态机）
- [x] 父任务 implement.md 完成（本文件）
- [ ] 子任务 data-systems-base 的 prd/design/implement 完成
- [ ] 用户审阅规划产物

## 子任务启动顺序

1. `task.py start` → `06-24-data-systems-base`（阶段1）
2. 阶段1 完成验证 → `task.py start` → `06-24-ui-layout-nav`（阶段2）
3. 阶段2 完成验证 → `task.py start` → `06-24-turn-based-combat`（阶段3）
