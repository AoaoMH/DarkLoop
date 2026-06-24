# 实施计划：关卡怪物系统解耦迭代

## 实施顺序

按依赖关系分 7 个阶段，每阶段完成后验证再进入下一阶段。

---

## Phase 1: 类型定义基础

**文件**: `shared/src/types/index.ts`

**任务**:
1. 新增 `SkillTargeting`、`ChainSelection` 类型
2. 在 `Skill` 接口添加 `targeting`、`targetCount`、`chainSelection`、`chainDecay`、`multiTargetDamageRate` 字段
3. 新增 `MonsterTemplate` 接口
4. 新增 `EnemyCombatState` 接口
5. 新增 `RegionDef` 接口
6. 修改 `LevelDef`：添加 `regionId`、`stageNum` 字段
7. 修改 `WaveDef`：改为 `monsters: { templateId: string; level: number }[]`
8. 重构 `TurnState`：用 `enemies: EnemyCombatState[]` 替换单敌人字段，添加目标选择相关字段
9. 修改 `TurnAction`：添加 `targetUid`、`targetUids` 字段
10. 修改 `TurnLogEntry`：添加 `targetUid` 字段（记录攻击目标）
11. 标记 `Monster`、`MonsterDef`、`CombatResult`、`CombatLogEntry` 为待删除（暂保留避免编译错误）

**验证**: `pnpm tsc --noEmit` 通过（可能有未使用警告）

---

## Phase 2: 怪物模板系统

**文件**:
- `shared/src/constants/monsters.ts` (新建)
- `shared/src/constants/skills.ts` (修改)
- `shared/src/logic/monsterScale.ts` (新建)
- `shared/src/logic/combat.ts` (修改)

**任务**:
1. 在 `skills.ts` 中定义怪物通用技能（mob_tackle, mob_acid_spit, mob_frost_nova, mob_slam, mob_split, mob_heal 等），加入 `SKILL_MAP`
2. 创建 `monsters.ts`，定义 12-15 个怪物模板（3区域各4-5个，部分跨区域复用）
3. 创建 `monsterScale.ts`，实现 `scaleMonster(template, level)` 函数
4. 在 `combat.ts` 的 `calcDerivedStats` 添加 `applyLevelBonus` 参数（默认 true）
5. 为现有技能添加 `targeting` 字段（重击/盾击/裂伤斩/烈焰斩/雷霆突袭 → single，旋风斩 → auto_all，嘲讽/钢铁壁垒/不屈意志 → self）

**验证**: 类型检查通过；手动测试 `scaleMonster` 输出合理数值

---

## Phase 3: 大地区与关卡结构

**文件**:
- `shared/src/constants/regions.ts` (新建)
- `shared/src/constants/levels.ts` (改为 re-export)

**任务**:
1. 创建 `regions.ts`，定义 3 个区域 × 10 关卡
2. 每区域关卡模式：
   - 1-1~1-4: 2波小怪+1波精英
   - 1-5: Boss单独战
   - 1-6~1-9: 更高等级，类似模式
   - 1-10: Boss战（可能带随从）
3. 实现便捷函数：`getLevelById`、`getRegionByLevelId`、`getAllLevels`
4. `levels.ts` 改为 `export { REGIONS, getLevelById } from './regions'` 并导出兼容的 `LEVELS` 数组

**验证**: 类型检查通过；检查关卡数据完整性（每关有波次、推荐等级、首通奖励）

---

## Phase 4: 战斗系统重构

**文件**:
- `shared/src/logic/turnBasedCombat.ts` (大改)
- `shared/src/logic/monsterAI.ts` (新建)
- `shared/src/logic/combat.ts` (修改 calcDamage)

**任务**:
1. 重写 `initTurnState`：从波次定义生成 `EnemyCombatState[]`，初始化多敌人 TurnState
2. 重写 `runTurn`：支持目标参数，处理 single/chain/multi/auto_all/self 目标模式
3. 重写 `runEnemyTurn`：遍历所有存活敌人依次行动
4. 新增 `resolvePlayerAction` 目标逻辑：按 targeting 模式分配伤害到目标
5. 新增连锁伤害计算：主目标全额，次要目标按 chainDecay 衰减
6. 新增 AOE 伤害计算：所有存活敌人按 multiTargetDamageRate 计算
7. 重写 `resolveEnemyAction`：调用 AI 选择技能，对英雄造成伤害
8. 创建 `monsterAI.ts`：实现 `selectMonsterSkill` 效用评分函数
9. 修改 `calcDamage`：添加等级压制参数和计算
10. 修改波次推进逻辑：检查所有敌人死亡 → 推进波次
11. 更新 `calcBattleReward`：基于新关卡结构计算奖励
12. 在 `balance.ts` 添加等级压制常量

**验证**: 类型检查通过；手动模拟战斗流程（init → player action → enemy turn → wave advance → win）

---

## Phase 5: 英雄技能适配

**文件**: `shared/src/constants/skills.ts` (修改)

**任务**:
1. 确认现有技能 targeting 字段已设置（Phase 2 已完成大部分）
2. 重构旋风斩：移除旧 `multi_target` effect，改为 `targeting: 'auto_all'` + `multiTargetDamageRate: 0.5`
3. 新增技能：飞盾（chain, targetCount=3, chainDecay=0.7）
4. 新增技能：横扫（auto_all, multiTargetDamageRate=0.8）
5. 更新天赋树（如有需要，将新技能加入天赋树）

**验证**: 类型检查通过；SKILL_MAP 包含所有新技能

---

## Phase 6: 客户端 UI

**文件**:
- `client/src/components/AdventureMap.tsx` (重写)
- `client/src/game/scenes/BattleScene.ts` (大改)
- `client/src/components/TurnBattleUI.tsx` (大改)
- `client/src/stores/gameStore.ts` (修改)
- `client/src/styles/global.css` (修改)

**任务**:
1. **AdventureMap**: 
   - 区域标签栏（3个区域，锁定区域不可点）
   - 关卡网格（5×2，显示 1-1~1-10）
   - 关卡状态：通关✓ / 可挑战● / 锁定🔒
   - hover 浮窗显示推荐等级、波次、首通奖励
2. **gameStore**:
   - `startBattle` 使用新 LevelDef
   - `playerAction` 传递 targetUid
   - `enemyTurn` 处理多敌人依次行动
   - `advanceWave` 使用新波次推进逻辑
   - 更新 save/load（删除 stage/highestStage，更新 levelProgress）
3. **BattleScene**:
   - 多敌人精灵横向排列
   - 每敌人显示 HP条/等级/buff
   - 选目标模式高亮
   - 选中目标边框
4. **TurnBattleUI**:
   - 目标选择状态管理
   - 自动选择开关
   - 技能按钮点击 → 按 targeting 决定流程
   - 敌人点击 → 选择目标
   - 取消按钮
5. **CSS**: 新增区域标签、关卡网格、多敌人布局、目标选择高亮样式

**验证**: 启动开发服务器；测试完整战斗流程（选关卡 → 战斗 → 选目标 → 击杀敌人 → 推进波次 → 胜利/失败）

---

## Phase 7: 清理与验证

**任务**:
1. 删除 `server/src/services/templates.ts`
2. 删除 `shared/src/types/index.ts` 中遗留的 `Monster`、`MonsterDef`、`CombatResult`、`CombatLogEntry` 接口
3. 删除 `shared/src/logic/combat.ts` 中的 `simulateCombat` 函数
4. 清理所有未使用的 import
5. 全量类型检查 `pnpm tsc --noEmit`
6. 运行开发服务器完整测试：
   - 3个区域切换正常
   - 关卡解锁逻辑正确
   - 多怪物战斗正常
   - 目标选择（手动/自动）正常
   - 连锁/AOE 技能效果正确
   - 等级压制数值合理
   - 怪物 AI 行为合理
   - 波次推进正确
   - 存档/读档正常
7. 调整数值平衡（如有需要）

**验证**: 类型检查零错误；完整游戏流程可玩

---

## 风险文件与回滚点

| 风险文件 | 风险 | 回滚策略 |
|----------|------|----------|
| `turnBasedCombat.ts` | 改动最大，战斗逻辑核心 | Phase 4 前 git commit |
| `types/index.ts` | 类型变更影响全局 | Phase 1 前 git commit |
| `gameStore.ts` | 状态管理核心 | Phase 6 前 git commit |

## 验证命令

```bash
# 类型检查
pnpm tsc --noEmit

# 开发服务器
pnpm dev

# 构建
pnpm build
```
