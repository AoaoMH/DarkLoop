# 属性系统重构 - 执行计划

## 有序步骤

### Step1: types/index.ts 类型重构
- PrimaryStats 6 维（strength/agility/intelligence/vitality/spirit/luck）
- HeroStats 别名 = PrimaryStats
- DerivedStats ~22 项二级属性
- DamageCategory/AttackStyle/ElementKind/DamageInstance
- AffixTag/AffixStatKey/AffixDef/Affix
- Equipment.baseStats 改 Partial<PrimaryStats> + element 字段
- MonsterDef 改 baseStats: PrimaryStats + tags
- Hero.stats 改 PrimaryStats
- TurnState 加 heroDerived/enemyDerived/enemyTags/heroMaxRage
- BuffKind 加 slow/freeze/poison/curse/holy
- SkillEffectKind 加 slow/freeze/poison/curse/holy
- PlayerSave version=3

### Step2: balance.ts 公式常量
- STAT_SCALARS（6维→二级属性标量）
- DERIVED_BASE（二级属性基础值）
- 新元素参数（SLOW_SPEED_REDUCTION/FREEZE_SKIP_CHANCE/POISON_STACK_MAX/CURSE_STAT_REDUCTION/HOLY_UNDEAD_BONUS/HOLY_HEAL_RATE）
- 防御相关（BLOCK_PERCENT_CAP/STATUS_RESIST_CAP/ARMOR_K常数）

### Step3: defaults.ts 默认值
- DEFAULT_HERO_STATS 改 6 维（加 spirit=10/luck=10）

### Step4: equipment.ts 装备模板
- EQUIP_TEMPLATES baseStats 改 Partial<PrimaryStats>
- 战士装备 baseStats 用力量/体力为主

### Step5: levels.ts 关卡数据
- LEVELS 3 关怪物改 baseStats: PrimaryStats + tags
- 史莱姆（无tag）/骸骨（undead）/恶魔（element）
- boss 数据同步改

### Step6: combat.ts 核心公式重写
- calcDerivedStats(base, equipment, level): DerivedStats
- calcDamage(attacker, defender, instance): DamageResult
- 减伤公式改 armor/(armor+K) 递减曲线
- calcPhysicalDamage/calcMagicDamage 基于 DerivedStats
- calcFinalStats 删除或改为 calcDerivedStats 别名
- simulateCombat 适配新属性
- getAffixCount 保留

### Step7: loot.ts 词缀系统重写
- AFFIX_DEFS 完整词缀池（~30+ 条，含 tags）
- rollAffix(equipmentTags, rarity): Affix
- generateEquipment 适配新词缀 + element
- 命名规则适配

### Step8: turnBasedCombat.ts 战斗逻辑大改
- initTurnState 调 calcDerivedStats 算双方二级属性
- heroMaxHp/heroMaxRage 用 DerivedStats
- resolveAttack/resolveSkill 用 calcDamage
- 新增命中/格挡/吸血/反弹结算
- processStartOfTurn 加 hpRegen/resourceRegen
- 新增 processElementEffects（slow/freeze/poison/curse/holy）
- pushBuff 支持 poison 叠加逻辑
- calcBattleReward 运气影响掉落

### Step9: shared 验证
- pnpm --filter @darkloop/shared build
- pnpm typecheck

### Step10: gameStore.ts 存档迁移
- SAVE_VERSION = 3
- loadGame 检测非 v3 返回 false
- initGame 用新 DEFAULT_HERO_STATS

### Step11: CharacterPanel.tsx 重写
- 默认视图：基础 6 维 + 核心攻防（物理/魔法攻击力、护甲、魔抗）
- "详细属性"按钮切换完整视图
- 详细视图分类：攻击类/防御类/资源通用类，物理/魔法分开
- 返回按钮回基础视图

### Step12: client 验证
- pnpm typecheck
- pnpm --filter @darkloop/client build

## 验证命令
- `pnpm --filter @darkloop/shared build`
- `pnpm typecheck`
- `pnpm --filter @darkloop/client build`

## 风险点
- Step6 calcDamage 公式重写是核心，影响全部战斗
- Step7 词缀池 Tag 系统需仔细测试不出错误职业词缀
- Step8 turnBasedCombat 改动最大，需保证现有技能/天赋仍工作
- Step1 types 改动可能引发连锁类型错误

## 回滚点
- 每 Step 完成后 typecheck，失败则修该 Step
- Step6/7/8 是高风险，建议分别 commit
