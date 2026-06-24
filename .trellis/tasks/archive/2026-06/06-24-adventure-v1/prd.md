# 冒险玩法 v1 可行性流程

## Goal

搭建 DarkLoop 冒险玩法 v1 的完整可行性流程：从「左侧菜单选择冒险 → 地图选关 → 进入关卡 → 顶部 Step 推进 3 波小怪 + 1 boss → 回合制战斗 → 结算奖励」的闭环，配套战士职业、7 档装备稀有度、技能天赋盘、资源货币养成系统。其余菜单（铁匠铺/农田/伐木场/矿洞）锁定，后续迭代。

## Confirmed Facts (from codebase inspection)

- **技术栈**：monorepo（pnpm）。client = React19 + Vite6 + Phaser3.87 + Zustand5 + socket.io-client；server = Fastify5 + Prisma6(SQLite) + socket.io；shared = TS 类型 + 战斗/掉落逻辑 + 常量。
- **现有布局**（`packages/client/src/App.tsx`）：顶部装饰栏 | 左侧 `SideMenu` | 中间 `GameCanvas`(Phaser) + `InventoryPanel` overlay | 右侧 `CharacterPanel` | 底部 `ActionBar`。
- **现有 `SideMenu`**（`components/SideMenu.tsx`）：冒险/铁匠铺(unlock stage3)/农田(stage5)/伐木场(stage8)/矿洞(stage10)/背包。各菜单带进度条槽位。
- **现有 `ActionBar`**（`components/ActionBar.tsx`）：战斗中显示 攻击/技能/逃跑；非战斗按菜单显示「开始冒险/副本/Boss」「打造/强化/镶嵌」等按钮。
- **现有战斗**（`game/scenes/BattleScene.ts`）：Phaser 自动战斗，英雄 vs 单怪循环，`this.time.addEvent` 每 1200ms 自动攻击，无回合制，无波次。
- **现有共享类型**（`shared/src/types/index.ts`）：`HeroClass{Warrior,Mage,Ranger}`、`HeroStats{strength,agility,intelligence,vitality,critRate,critDamage,attackSpeed}`、`Rarity{Common,Magic,Rare,Epic,Legendary}`(5档)、`EquipSlot{Weapon,Armor,Helmet,Boots,Ring,Amulet}`、`Skill`、`Pet`、`Monster`、`LootEntry`、`CombatResult`、`Building`、`PlayerSave`。
- **现有稀有度配色**（`shared/src/constants/equipment.ts` `RARITY_COLORS`）：Common灰/Magic绿/Rare蓝/Epic紫/Legendary橙（WoW 配色）。需重做为用户指定的 7 档配色。
- **现有战斗逻辑**（`shared/src/logic/combat.ts`）：`simulateCombat` 时间驱动自动战斗（COMBAT_TICK_MS=100ms）；`calcFinalStats`/`calcPhysicalDamage`/`calcMagicDamage`/`rollCrit`/`calcDamageReduction`/`calcOfflineReward`。回合制需重写战斗循环。
- **现有掉落逻辑**（`shared/src/logic/loot.ts`）：`generateEquipment`/`rollRarity`/`generateAffix`，词缀池 7 项，词缀品阶 5 档。
- **现有存档**（`stores/gameStore.ts`）：localStorage `darkloop_save`，`PlayerSave{hero,buildings,gold,gems,stage,highestStage,...}`。无资源货币多维度养成。
- **Prisma**（`prisma/schema.prisma`）：`Player.saveData` JSON 字符串存档。当前未强依赖服务端，客户端单机可跑。
- **素材**（`material/`）：kenney_roguelike-rpg-pack、kenney_tiny-dungeon。`assets/sprites/` 待填充。

## Requirements

### R1 战士职业 + 配套装备（子任务 data-systems-base）
- 这一版只实现战士（Warrior）一个职业，Mage/Ranger 保留枚举但锁定。
- 装备稀有度扩展到 7 档：普通/优秀/稀有/史诗/传说/神话/至臻。
- 配色已确认：普通白 / 优秀绿 / 稀有蓝 / 史诗紫 / 传说橙 / 神话红 / 至臻炫彩。
- 神话(红) 和 至臻(炫彩) 默认不产出，仅定义，后续迭代开启。
- 装备模板覆盖战士可用部位，与现有 `EQUIP_TEMPLATES` 对齐扩展。

### R2 技能树 + 天赋盘（子任务 data-systems-base）
- 战士有技能树（主动/被动技能）。
- 天赋盘已确认：**路径式技能树·3 分支**（Diablo 风），分支暂定狂暴(输出)/坚壁(防御)/战吼(辅助)，节点线性解锁有前置依赖。
- 一个职业可搭配出多种玩法（BD），玩家可自由分配点数到不同分支。
- 点数来源：升级每级 1 点；重置：免费随时重置。Hero 结构需 `talentPoints`/`spentPoints` 字段。

### R3 底部栏改资源信息栏（子任务 ui-layout-nav）
- 去掉 `ActionBar` 的「开始冒险/副本/Boss」等功能按钮。
- 整个底部栏负责显示资源信息（金币、钻石及新增养成资源）。
- 战斗操作的入口需重新定位（回合制战斗 UI 在战斗场景内）。

### R4 资源货币养成系统（子任务 data-systems-base）
- 设计带养成逻辑的资源和货币系统，不只是 gold/gems。
- 已确认 4 资源：**金币**(战斗掉落/卖装备/基础货币) + **经验**(战斗掉落/升级角色/得天赋点) + **钻石**(关卡首通·成就/高级货币预留) + **冒险勋章**(关卡首通/养成/解锁更高难度)。
- 养成闭环：战斗→资源→经验升级→天赋点→变强→更高关卡→更多资源。勋章解锁难度=养成维度。
- 底部资源栏显示这 4 种资源。

### R5 左侧菜单切换中间内容（子任务 ui-layout-nav）
- 点击左侧菜单不同项时，中间渲染区渲染不同内容（而非恒为 Phaser 画布）。
- 冒险 → 地图选关界面；背包 → 背包面板；其他菜单锁定态。
- 中间区按 `activeMenu` 路由。

### R6 仅冒险可用，其他锁定（子任务 ui-layout-nav）
- 这一版只做冒险，铁匠铺/农田/伐木场/矿洞显示锁定，后续迭代。
- 锁定态保留现有 `unlockStage` 机制。

### R7 冒险地图 + 3 关卡（子任务 ui-layout-nav）
- 选择冒险时渲染一套地图，3 个关卡，难度递增。
- 地图 UI：关卡节点，可点击。
- 已确认 3 关主题（平缓曲线）：关卡1 史莱姆平原(小怪Lv1·boss Lv2) / 关卡2 骸骨墓地(小怪Lv3·boss Lv4) / 关卡3 恶魔巢穴(小怪Lv5·boss Lv7)。具体数值见 design.md。

### R8 关卡悬浮描述 + 开始战斗（子任务 ui-layout-nav）
- 选择关卡后悬浮显示描述信息（关卡名/难度/怪物/boss/奖励预览）。
- 悬浮面板有「开始战斗」按钮。

### R9 关卡内顶部 Step + 波次（子任务 turn-based-combat）
- 进入关卡后顶部渲染 Step 进度（波次进度）。
- 每关默认 3 波小怪 + 1 个 boss，共 4 步。

### R10 回合制战斗（子任务 turn-based-combat）
- 战斗改为回合制，不要自动化。
- 已确认：**经典回合制 + 怒气系统**。玩家回合选 1 行动（攻击/技能/防御/逃跑）→ 结算 → 敌方 AI 回合 → 循环。速度高者先手。
- 怒气：攻击+10/受击+15/防御+20，上限 100，技能消耗怒气。防御=减伤+积怒。逃跑=概率成功。
- 行动选项本版：攻击/技能/防御/逃跑（道具暂不做，背包仅显示）。
- 怪物 AI：简单策略（攻击为主，条件触发技能）。
- 自动放置/自动战斗是后续开发内容，不在本版。
- 回合制与现有 `simulateCombat`（时间驱动）不兼容，需重写战斗循环。

## Subtask Map

| 子任务 | slug | 职责 | 依赖 |
|--------|------|------|------|
| 数据与系统基础 | `06-24-data-systems-base` | 稀有度7档/配色、资源货币、天赋盘、关卡定义、战士技能 | 无（其他子任务依赖其类型） |
| UI 布局与导航重构 | `06-24-ui-layout-nav` | 底部资源栏、菜单路由中间内容、冒险地图选关、关卡悬浮描述 | 依赖 data-systems-base 的类型/常量 |
| 回合制战斗与关卡波次 | `06-24-turn-based-combat` | 回合制战斗引擎、波次推进、顶部 Step、结算 | 依赖 data-systems-base 的关卡/怪物定义 |

## Cross-Subtask Acceptance Criteria

- [ ] 启动客户端后，左侧菜单只有「冒险」和「背包」可点击，其余锁定态。
- [ ] 点击「冒险」→ 中间渲染地图，3 个关卡节点难度递增。
- [ ] 点击关卡 → 悬浮描述 → 「开始战斗」→ 进入关卡，顶部显示 Step（1/4...4/4）。
- [ ] 战斗为回合制：玩家选择行动 → 结算 → 敌方行动 → 循环，无自动攻击。
- [ ] 3 波小怪清完 → boss 波 → 击败 boss → 结算奖励（金币/经验/装备掉落）。
- [ ] 装备稀有度显示 7 档配色，红/炫彩档不产出。
- [ ] 底部栏只显示资源信息，无「开始冒险/副本」按钮。
- [ ] 战士有技能树 + 天赋盘，可搭配不同玩法。
- [ ] 资源货币系统有养成维度（升级/产出/消耗）。
- [ ] `pnpm typecheck` 通过。

## Out of Scope

- Mage/Ranger 职业实现（仅保留枚举）。
- 铁匠铺/农田/伐木场/矿洞玩法（锁定态）。
- 自动战斗/自动放置/离线挂机（后续迭代）。
- 多人联机/socket 同步（现有协议保留但不启用）。
- 宠物系统实装（类型保留）。
- 红色/炫彩品质装备的实际产出（仅定义）。
- 服务端存档/账号系统（本版客户端 localStorage 即可）。

## Open Questions (block planning)

全部已澄清：

1. ~~品质配色~~ ✅ 白/绿/蓝/紫/橙/红/炫彩。神话+至臻不产出。
2. ~~天赋盘结构~~ ✅ 路径式·3 分支（狂暴/坚壁/战吼），升级每级1点，免费重置。
3. ~~资源货币~~ ✅ 金币/经验/钻石/冒险勋章 4 资源，勋章解锁难度=养成维度。
4. ~~回合制细节~~ ✅ 经典回合制+怒气系统，行动=攻击/技能/防御/逃跑，道具暂不做。
5. ~~关卡设计~~ ✅ 平缓曲线·3 主题（史莱姆平原/骸骨墓地/恶魔巢穴），具体数值见 design.md。
