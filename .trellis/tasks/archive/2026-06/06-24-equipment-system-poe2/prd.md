# 重构装备系统为POE2风格

## Goal

将现有装备系统重构为简化版 POE2 风格：装备 = 基底（含隐式词缀）+ 前缀 + 后缀，支持 T 级随机数值、按职业/部位倾向掉落，并保留附魔/特殊词缀的扩展性。

## 用户价值

- 装备有深度：基底决定基础定位，前缀后缀决定随机属性方向，T 级决定数值强弱
- 掉落有倾向：战士多掉战士用的基底和词条，武器多出攻击词条，防具多出防御词条
- 可扩展：后续可逐步迁移 POE2 的打造系统（附魔、通货、腐蚀等）

## POE2 装备系统调研（confirmed facts from web research）

### 稀有度（4 档）
| 稀有度 | 颜色 | 词缀数 | 结构 |
|--------|------|--------|------|
| Normal 普通 | 白 | 0 | 仅基底 + 隐式词缀 |
| Magic 魔法 | 蓝 | 1-2 | 1 前缀 + 1 后缀 |
| Rare 稀有 | 黄 | 3-6 | 3 前缀 + 3 后缀（部分物品类型上限 4） |
| Unique 传奇 | 橙 | 固定 | 预定义词缀，不走随机池 |

### 词缀类型
- **Implicit 隐式词缀**：基底自带，所有同类物品恒定拥有，不占用前缀/后缀位
- **Explicit 显式词缀**：随机生成的前缀或后缀
  - **Prefix 前缀**：主属性方向（伤害、生命、法力、移速等）
  - **Suffix 后缀**：副属性方向（抗性、命中、暴击等）
- **Enchantment 附魔**：通过符文/特殊手段添加，占独立槽位（本次不实现）
- **Corruption 腐蚀**：Vaal Orb 产生的特殊附魔（本次不实现）

### Tier 系统
- POE2 当前版本：**T1 = 最高/最好**，T 数字越大越弱（与 POE1 一致，早期 EA 曾反转后改回）
- 每个词缀有不同数量的 tier（例如生命词缀可能有 10 个 tier，暴击率只有 5 个）
- **Item Level (ilvl)** 决定可以 roll 到哪些 tier：ilvl 越高，可访问的 tier 范围越广
- tier 的 ilvl 要求是隐藏的，需要查 poe2db 等数据库

### 基底（Base Type）
- 每个基底有：物品类别（武器/防具/饰品）、需求等级、隐式词缀、基础属性
- 基底决定可用的词缀池（不同基底的 prefix/suffix 池不同）
- 更强的基底通常有更高的掉落等级要求

### Local vs Global
- Local 局部词缀：只影响该装备本身（如武器的物理伤害 %）
- Global 全域词缀：影响角色整体（如全域伤害 %）
- 本次简化版可暂不区分 local/global，统一按 global 处理

### Mod Group（词缀组）
- 同一词缀组的词缀不能同时出现在一件装备上（防止重复属性）
- 例如：两个"增加物理伤害"的词缀属于同一 group，只能出现一个

## 当前系统分析（confirmed facts from codebase）

### 现有结构
- **稀有度**：7 档（Common→Apex），Mythic/Apex 默认不掉落
- **词缀**：所有词缀在一个 `affixes: Affix[]` 数组中，无前缀/后缀区分
- **Tier**：5 档，T1=最弱（`AFFIX_TIER_SCALE = [1, 1.8, 3, 5, 8]`），与 POE2 相反
- **基底**：`EQUIP_TEMPLATES` 只有 `baseStats: Partial<HeroStats>`，无隐式词缀
- **词缀池**：30+ 条 `AFFIX_DEFS`，用 `tags` 系统过滤（universal/physical/magic/warrior 等）
- **去重**：仅按 `defId` 去重，无 mod group 概念
- **掉落倾向**：`generateEquipment(itemLevel, dropRateBonus, forcedSlot?, heroTags?)`，heroTags 默认 warrior
- **存档**：`SAVE_VERSION = 3`，加载时检查版本不匹配返回 false

### 关键文件
- `packages/shared/src/types/index.ts` — 类型定义（Rarity, EquipSlot, AffixDef, Affix, Equipment）
- `packages/shared/src/constants/equipment.ts` — 装备常量（AFFIX_TIERS, RARITY_WEIGHTS, EQUIP_TEMPLATES）
- `packages/shared/src/logic/loot.ts` — 掉落生成逻辑（AFFIX_DEFS, rollAffix, generateEquipment）
- `packages/shared/src/logic/combat.ts` — 属性聚合（calcCombinedPrimary, calcDerivedStats, getAffixCount）
- `packages/client/src/components/EquipTooltip.tsx` — 装备 tooltip 展示
- `packages/client/src/components/CharacterPanel.tsx` — 装备槽展示
- `packages/client/src/stores/gameStore.ts` — 存档管理（SAVE_VERSION=3）

## Requirements

### R1: 装备结构重构
- Equipment 拆分为 `implicit`（隐式词缀）+ `prefixes[]` + `suffixes[]` + `specialAffix?`（Legendary）
- 基底携带隐式词缀和基础属性
- 保留 `id`, `name`, `slot`, `rarity`, `requiredLevel`, `icon` 字段
- 预留 `enchantments?` 和 `corrupted?` 字段供未来扩展

### R1.1: 装备槽位（8 槽）
| 槽位 | 说明 |
|------|------|
| Weapon | 主手武器，单手或双手 |
| OffHand | 副手：盾牌/法器等；装备双手武器时此槽被占用 |
| Armor | 胸甲 |
| Helmet | 头盔 |
| Boots | 鞋子 |
| Ring1 | 戒指槽 1 |
| Ring2 | 戒指槽 2 |
| Amulet | 项链 |
- 基底标记 `twoHanded: boolean`，双手武器装备时锁定 OffHand 槽
- 副手基底类型：Shield（盾牌，偏防御）、Focus（法器，偏魔法）等

### R2: 稀有度与词缀位（6 档）
| 稀有度 | 颜色 | 前缀 | 后缀 | 特殊词缀 | 说明 |
|--------|------|------|------|----------|------|
| Normal 普通 | 白 | 0 | 0 | 0 | 仅基底 + 隐式词缀 |
| Magic 魔法 | 蓝 | 1 | 1 | 0 | 基础随机词缀 |
| Rare 稀有 | 黄 | 2 | 2 | 0 | 回合制适配，2+2 而非 POE2 的 3+3 |
| Epic 史诗 | 紫 | 3 | 3 | 0 | 满词缀，后续打造系统可在此基础上操作 |
| Legendary 传说 | 橙 | 3 | 3 | 1 | 额外特殊词缀（技能附加效果/天赋级效果），区别于 Epic |
| Apex 至臻 | 炫彩 | ? | ? | ? | 不产出，后续逐步补全设定 |

- Legendary 的特殊词缀独立于前缀/后缀池，效果类似技能天赋（如给某技能加附加效果、+1 技能等级等）
- Apex 保留炫彩分类，暂不产出，后续扩展更多效果
- 去掉 Mythic（原 7 档中的第 6 档），合并入 Apex

### R3: Tier 与等级缩放系统
- 8 档 tier，T1=最好，T8=最差，**全等级可出**（不锁 tier）
- Tier 倍率与权重：

| Tier | 倍率 | 权重 |
|------|------|------|
| T1 | 2.0x | 2% |
| T2 | 1.7x | 5% |
| T3 | 1.4x | 8% |
| T4 | 1.2x | 12% |
| T5 | 1.0x | 15% |
| T6 | 0.8x | 18% |
| T7 | 0.6x | 20% |
| T8 | 0.4x | 20% |

- 等级缩放（线性）：`levelScale = 1 + (ilvl - 1) * 0.1`
- 最终词缀数值：`finalValue = randomInRange(baseRange) × tierMultiplier × levelScale`
- ilvl = 怪物等级（直接等同）
- 同等级 T1 是 T8 的 5 倍，抽奖感强
- 高等级 T8 仍比低等级 T1 强，保证升级装备有意义
- 数值膨胀温和（50 级约 5 倍），适合回合制游戏

### R4: 前缀/后缀词缀池
- 每个词缀定义标记为 prefix 或 suffix
- 前缀池：攻击向（物理攻击、魔法攻击、暴击伤害、全域伤害等）
- 后缀池：防御/辅助向（护甲、抗性、命中、暴击率、吸血等）
- 按 slot 和 class 过滤可用词缀

### R5: Mod Group 防重复
- 每个词缀定义包含 `group` 字段
- 同一 group 的词缀不能同时出现在一件装备上

### R6: 掉落倾向
- 按 heroClass 加权掉落可用基底（战士多掉剑/板甲，少掉法杖/布甲）
- 按 slot 决定词缀方向（武器偏攻击词缀，防具偏防御词缀）
- tag 系统保留并增强：增加 slot tag（weapon_offensive / armor_defensive）

### R7: 存档版本
- SAVE_VERSION 升级到 4
- 开发阶段无旧存档，无需迁移逻辑
- 更新默认测试数据适配新版装备结构

### R8: 装备命名（POE2 风格）
- Normal：仅基底名（如「铁剑」）
- Magic：[前缀词] + 基底名 + [of 后缀词]（如「锋利的铁剑·寒霜」），前缀词和后缀词由词缀定义提供
- Rare+：从名字池随机生成两段式名字（如「毁灭之噬·空洞锋刃」），不再简单拼接稀有度前缀
- 基底类型名单独显示在物品类型行（如「单手剑」/「胸甲」）

### R9: 客户端展示
- EquipTooltip 适配新结构：隐式词缀 / 前缀 / 后缀 / 特殊词缀 分区显示
- 前缀后缀分别标注（如 POE2 中前缀在上后缀在下）
- Legendary 特殊词缀用特殊颜色/样式高亮

## Out of Scope（本次不实现）
- 打造系统（通货、Essence、Crafting Bench 等）
- 附魔槽（Rune/Soul Core）
- 腐蚀（Vaal Orb）
- Local/Global 词缀区分
- Quality 系统
- Unique 传奇装备的预定义词缀（仅预留结构）

## Open Questions

1. ~~稀有度是简化为 POE2 的 4 档，还是保留现有 7 档并映射？~~ → **已决定：6 档（Normal/Magic/Rare/Epic/Legendary/Apex），Legendary 带特殊词缀，Apex 不产出**
2. ~~存档迁移策略~~ → **已决定：开发阶段无旧存档，直接升版本号 + 更新测试数据**
3. ~~现有 6 个 EquipSlot 是否需要扩展？~~ → **已决定：8 槽（Weapon/OffHand/Armor/Helmet/Boots/Ring1/Ring2/Amulet），双手武器占用 Weapon+OffHand**
4. ~~ilvl 与怪物等级的关系~~ → **已决定：ilvl = 怪物等级，全 tier 可出，数值随等级线性缩放**
5. ~~基底数量~~ → **已决定：每个部位至少 3 个基底，代码保留可扩展性，后续可继续增加**

## Acceptance Criteria

- [ ] 装备结构为 BaseType + implicit + prefixes[] + suffixes[] + specialAffix?(Legendary)
- [ ] 6 档稀有度，Legendary 有特殊词缀，Apex 保留不产出
- [ ] POE2 风格命名（Magic 前后缀拼接，Rare+ 名字池随机）
- [ ] T1 = 最高 tier（2.0x），全等级可出，数值随 ilvl 线性缩放
- [ ] 前缀偏攻击、后缀偏防御，按 slot 过滤
- [ ] 战士掉落偏战士基底和词条
- [ ] Mod Group 防止同组词缀重复
- [ ] 每个部位至少 3 个基底，含隐式词缀和职业标记
- [ ] 8 槽位（含 OffHand + Ring2），双手武器锁 OffHand
- [ ] 存档版本升级到 4，测试数据适配
- [ ] EquipTooltip 正确展示新结构（隐式/前缀/后缀/特殊词缀分区）
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm --filter @darkloop/shared build` 通过
- [ ] `pnpm --filter @darkloop/client build` 通过