# 实施计划：POE2 风格装备系统

## 实施步骤

### Step 1: types/index.ts 类型重构
- 新增 `AffixKind`, `RolledMod`, `ImplicitModDef`, `BaseType` 类型
- 重构 `AffixDef`（加 kind/group/baseRange/nameWord）
- 重构 `Equipment`（implicit/prefixes/suffixes/specialAffix/itemLevel/baseTypeId）
- 更新 `EquipSlot`（新增 OffHand/Ring2，原 Ring 改 Ring1）
- 更新 `Rarity`（去掉 Fine/Mythic，新增 Magic，保留 Apex）
- 保留 `AffixTag` 并扩展（加 slot/offensive/defensive/support tag）
- 废弃旧 `Affix` 类型（保留为 deprecated 别名以防连锁错误）

### Step 2: constants/equipment.ts 常量重写
- `AFFIX_TIERS` → 8 档（T1=2.0x ... T8=0.4x + weights）
- `RARITY_WEIGHTS` → 6 档（Normal/Apex 调整）
- 新增 `RARITY_AFFIX_SLOTS`（prefix/suffix/special 位数表）
- 新增 `LEVEL_SCALE_RATE = 0.1`
- `EQUIP_TEMPLATES` → `BASE_TYPES`（~25+ 条，每部位≥3，含 implicit/twoHanded/classRestriction）
- 新增 `RARE_NAME_POOL`（Rare+ 命名用词池）
- 保留 `RARITY_COLORS` / `RARITY_NAMES`（适配 6 档）

### Step 3: logic/loot.ts 词缀池与生成逻辑重写
- `AFFIX_DEFS` 重写（40+ 条，标记 kind/group/tags/baseRange/nameWord）
  - Prefix 池：~20 条（攻击向）
  - Suffix 池：~20 条（防御/辅助向）
- 新增 `SPECIAL_AFFIX_DEFS`（Legendary 特殊词缀池，~8 条）
- 实现 `rollTier()` — 按 AFFIX_TIERS 权重
- 实现 `calcLevelScale(ilvl)` — 1 + (ilvl-1)*0.1
- 实现 `rollAffixValue(def, tier, ilvl)` — baseRange × tierMultiplier × levelScale
- 实现 `rollPrefix(tags, ilvl, usedGroups)` / `rollSuffix(...)`
- 实现 `rollImplicit(base, ilvl)`
- 实现 `rollSpecialAffix(ilvl)` — Legendary 专用
- 实现 `deriveTags(base, slot, heroClass)` — 新 tag 推导
- 重写 `generateEquipment(ilvl, heroClass, opts?)` — 完整生成流程
- 实现 `generateItemName(base, rarity, prefixes, suffixes)` — POE2 风格命名
- 废弃旧 `rollAffix` / `deriveEquipTags` / `getAffixCount` 引用

### Step 4: logic/combat.ts 属性聚合适配
- `calcCombinedPrimary` → 遍历 equipment 的 baseStats + implicit + prefixes + suffixes + specialAffix
- `calcDerivedStats` → 同上，derived stat 词缀累加
- 废弃 `getAffixCount`，调用方改用 `RARITY_AFFIX_SLOTS`
- 保留 `simulateCombat` / `calcOfflineReward` 等（适配新 Equipment 结构）

### Step 5: shared 包验证
- `pnpm --filter @darkloop/shared build`
- `pnpm typecheck`
- 修复所有类型错误

### Step 6: logic/turnBasedCombat.ts 适配
- 检查所有引用 `Equipment.affixes` 的地方，改为遍历 implicit + prefixes + suffixes + specialAffix
- `calcBattleReward` 中掉落生成改用新 `generateEquipment` 签名

### Step 7: gameStore.ts 存档与测试数据
- `SAVE_VERSION = 4`
- 默认 hero 数据适配新 Equipment 结构（空装备或新格式测试装备）
- `loadGame` 版本检查改为 4

### Step 8: EquipTooltip.tsx 重写
- 分区显示：物品类型行 → 隐式词缀（灰）→ 前缀（蓝）→ 后缀（蓝）→ 特殊词缀（橙高亮）
- `formatValue` 适配新 `RolledMod` 结构
- 名称行显示生成的 `name`

### Step 9: CharacterPanel.tsx 适配
- 装备槽从 6 个扩展到 8 个（新增 OffHand + Ring2）
- 双手武器装备时 OffHand 槽显示锁定状态
- 装备/卸下逻辑适配双手武器占用规则

### Step 10: TurnBattleUI.tsx + InventoryPanel.tsx 适配
- 掉落展示适配新 Equipment 结构
- 背包面板适配新字段

### Step 11: client 包验证
- `pnpm typecheck`
- `pnpm --filter @darkloop/client build`
- 修复所有类型错误

### Step 12: 全局验证
- `pnpm typecheck` 全通过
- `pnpm --filter @darkloop/shared build` 通过
- `pnpm --filter @darkloop/client build` 通过
- 手动检查关键逻辑：掉落生成、属性聚合、tooltip 展示

## 验证命令
- `pnpm --filter @darkloop/shared build`
- `pnpm typecheck`
- `pnpm --filter @darkloop/client build`

## 风险点
- Step 1 类型改动是基础，会引发大量连锁类型错误
- Step 3 词缀池设计是核心，prefix/suffix/group 分类需仔细
- Step 4 combat.ts 属性聚合影响全部战斗，需保证不漏词缀
- Step 9 CharacterPanel 双手武器逻辑容易出边界 bug

## 回滚点
- 每 Step 完成后 typecheck，失败则修该 Step
- Step 1-3 是 shared 包改动，可独立 commit
- Step 4-6 是逻辑适配，可独立 commit
- Step 7-11 是客户端改动，可独立 commit
