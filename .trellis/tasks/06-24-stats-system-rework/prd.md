# 属性系统重构

## Goal

重写底层属性系统，建立"基础属性 → 二级属性 → 伤害类型 → 装备词缀"的分层架构，
支持多职业、多伤害类型、多元素、词缀 Tag 限制，保证计算逻辑优雅可扩展、性能良好。
为后续法师/游侠职业、更多技能/buff/debuff 扩展打好基础。

## Confirmed Facts（代码探查）

- 当前 `HeroStats` 仅 4 维（strength/agility/intelligence/vitality）+ critRate/critDamage/attackSpeed
- 当前战斗只用 `calcPhysicalDamage`(力量驱动) / `calcMagicDamage`(智力驱动) / `calcDamageReduction`(体质驱动)
- 当前 `Affix.stat` 只能是 `keyof HeroStats`，词缀池 7 项（力/敏/智/体/暴击/暴伤/急速）
- 当前 `Equipment.baseStats` 是 `Partial<HeroStats>`
- 当前 `TurnState` 有 heroRage/heroShield/heroChargeBonus，无命中/闪避/格挡/吸血/速度压制
- 当前 `BuffKind` 含 stun/bleed/burn/shield/pierce/charging/atk_down/paralyse/taunt/indomitable/counter/def_up/def_down/rage_gain
- 当前 `SkillEffectKind` 同上 + atk_up/multi_target/heal
- 已实现元素效果：火焰(燃烧 burn)、闪电(麻痹 paralyse)
- 未实现元素：冰霜、毒素、暗影、神圣
- `SAVE_VERSION = 2`，存档含 hero.stats(4维)/equipment/inventory
- 怪物 `MonsterDef` 有 hp/atk/def/speed，无二级属性
- `combat.ts` simulateCombat 为离线挂机预留（v1 未用），需兼容新属性
- 战士技能全部怒气制无冷却，cooldown 字段存在但未使用

## Requirements

### R1 基础属性 6 维
- 力量 strength：近战物理攻击力、格挡值
- 敏捷 agility：远程攻击力、物理暴击率、闪避率
- 智力 intelligence：魔法攻击力、魔法暴击率、魔法抗性
- 体力 vitality：生命值上限、生命回复、护甲
- 精神 spirit：异常状态抗性、暴击伤害减免、宠物伤害继承率
- 运气 luck：掉落品质和稀有词缀概率

### R2 二级属性
- maxHp 最大生命值
- maxResource 资源上限（战士=怒气，后续法师=魔法值）
- physicalAttack / rangedAttack / magicAttack 三种攻击力
- armor 护甲（物理减伤）/ magicResist 魔法抗性（魔法减伤）
- critRate 暴击率 / critDamage 暴击伤害（默认 150%）
- accuracy 命中 / evade 闪避
- blockRate 格挡率 / blockValue 格挡固定值 / blockPercent 格挡百分比减伤
- armorPierce 护甲穿透 / magicPierce 魔法穿透
- physicalLeech 物理吸血 / magicLeech 魔法吸血
- hpRegen 每回合生命回复 / resourceRegen 每回合资源回复
- cooldownReduction 冷却缩减
- statusResist 异常状态抗性
- damageReflect 伤害反弹
- speed 速度（决定先后手）

### R3 伤害类型框架
- 大类：physical / magic
- 物理子类：melee / ranged（仅攻击形式差异）
- 元素：fire / ice / lightning / poison / shadow / holy
- 元素伤害可为物理也可为魔法（支持参数扩展）
- DamageInstance 结构：{ category, style?, element?, amount, isCrit?, sourceSkill? }

### R4 元素效果
- 火焰 fire：持续伤害（已实现 burn）
- 冰霜 ice：减速 / 冰冻（新增）
- 闪电 lightning：连锁 / 麻痹（已实现 paralyse）
- 毒素 poison：可叠加的持续伤害（新增，区别于 bleed 可叠加）
- 暗影 shadow：诅咒 debuff（新增）
- 神圣 holy：对非亡灵治疗，对亡灵伤害（新增）

### R5 装备词缀 Tag 系统
- 词缀支持二级属性 + 特殊词缀：
  -全域伤害提高（inc）/ 额外伤害（more）
  -对精英/BOSS 伤害加成
  -流血概率 / 额外元素伤害
  -幸运 / 金币加成 / 经验加成
- 词缀带 Tag 限制可出现的职业/类型：
  - universal（全域，所有职业可出）
  - physical / magic / ranged（物理/魔法/远程专属）
  - warrior / mage / ranger（职业专属）
  - element tag（fire/ice/... 元素专属）
- 防止出其他职业的装备

### R6 战斗公式重写
- 攻击力由职业决定伤害类型（战士物理，法师魔法）
- 命中 vs 闪避判定（未命中不造成伤害）
- 格挡率触发 → 格挡减伤（百分比 + 固定值）
- 护甲/魔抗减伤（含穿透计算）
- 暴击判定（含暴击伤害）
- 吸血结算
- 伤害反弹结算
- 每回合 hpRegen / resourceRegen
- 异常状态抗性影响 buff 触发率

### R7 存档迁移
- SAVE_VERSION 2 → 3
- 开发阶段无旧存档，loadGame 检测非 v3 返回 false 重建

### R8 扩展性
- 技能/属性/伤害类型/buff/debuff 将来会增加
- 计算逻辑分层清晰，新增类型不改核心公式
- 性能：避免战斗循环中重复计算

### R9 CharacterPanel 分层展示
- 默认视图：基础属性 6 项 + 核心攻防（物理/魔法攻击力、护甲、魔抗）
- "详细属性"按钮：点击后面板切换为完整二级属性列表，分类显示（攻击类/防御类/资源通用类，物理/魔法分开）
- 再点返回基础视图

### R10 怪物对等属性
- MonsterDef 改为 6 维基础属性 + 等级 + tags（如 undead/element 标记）
- initTurnState 时计算怪物二级属性（与英雄同公式）
- 战斗公式英雄/怪物对等

## Acceptance Criteria

- [ ] HeroStats 扩为 6 维基础属性
- [ ] DerivedStats 二级属性由基础属性+装备+词缀计算得出
- [ ] 伤害类型框架支持物理/魔法 + 6 元素
- [ ] 装备词缀带 Tag 限制
- [ ] 战斗公式支持命中/闪避/格挡/吸血/反弹/回血/回资源
- [ ] 怪物支持新属性体系
- [ ] CharacterPanel 显示新属性
- [ ] 存档版本升级且旧存档可处理
- [ ] pnpm typecheck + pnpm --filter @darkloop/shared build + pnpm --filter @darkloop/client build 通过

## Out of Scope

- 法师/游侠职业实装（仅框架预留）
- 速度压制（连续两轮行动，v1 只做先后手）
- 宠物伤害继承率实装（仅属性定义）
- 冷却技能实装（框架预留，战士技能仍怒气制）
- 离线挂机用新公式重算（保持兼容即可）

## Open Questions

- 无（关键决策已全部确认）
