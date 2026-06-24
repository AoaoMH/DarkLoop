# 数据与系统基础：稀有度7档/资源货币/天赋盘/关卡/战士

**父任务**: 06-24-adventure-v1

## Goal

交付 shared 层全部类型/常量/关卡定义/回合制纯逻辑，作为其他子任务的基础。完成后 `pnpm --filter @darkloop/shared build` + `pnpm typecheck` 通过，且 ui-layout-nav 和 turn-based-combat 所需的 shared 导出全部就位。

## Confirmed Facts

- 现有 `shared/src/types/index.ts` 已有 5 档 Rarity、Hero、Skill、Equipment、Monster 等类型骨架。
- 现有 `shared/src/constants/equipment.ts` 有 RARITY_COLORS(WoW配色)/RARITY_WEIGHTS/AFFIX_TIERS/EQUIP_TEMPLATES。
- 现有 `shared/src/constants/balance.ts` 有 GAME_BALANCE 数值常量。
- 现有 `shared/src/logic/combat.ts` 有 calcFinalStats/calcPhysicalDamage/calcMagicDamage/rollCrit/calcDamageReduction/simulateCombat/getAffixCount。
- 现有 `shared/src/logic/loot.ts` 有 generateEquipment/rollRarity/generateAffix。
- 现有 `shared/src/index.ts` 统一 re-export types+logic+constants。

## Requirements

### R1 稀有度 7 档
- Rarity 枚举：Common(普通)/Fine(优秀)/Rare(稀有)/Epic(史诗)/Legendary(传说)/Mythic(神话)/Apex(至臻)。将原 Magic 重命名为 Fine。
- RARITY_COLORS：Common#e0e0e0白 / Fine#1eff00绿 / Rare#0070dd蓝 / Epic#a335ee紫 / Legendary#ff8000橙 / Mythic#ff3b3b红 / Apex 炫彩(线性渐变)。
- RARITY_WEIGHTS：Common50/Fine30/Rare14/Epic5/Legendary1/Mythic0/Apex0（神话至臻不产出）。
- getAffixCount 扩展到 7 档：Common0/Fine1-2/Rare2-4/Epic3-5/Legendary4-6/Mythic5-7/Apex6-8。

### R2 资源货币 4 种
- ResourceKind 枚举：Gold/Exp/Gems/Badge。
- Resources 接口：{gold,exp,gems,badge}。
- 产出规则常量：BASE_GOLD_PER_KILL(沿用5)/BASE_EXP_PER_KILL(沿用10)/关卡首通 gems+badge(见关卡表)。

### R3 天赋盘（路径式3分支）
- TalentNode 接口：{id, branch:'berserk'|'bulwark'|'warcry', tier, name, desc, effects, requires[], maxRank}。
- TalentTree 接口 + WARRIOR_TALENT_TREE 常量：3 分支各 5-6 节点，tier 递增，requires 前置。
- 分支方向：berserk=暴击/攻强/怒气增益；bulwark=减伤/血量/防御；warcry=团队buff/怒气恢复/辅助。
- Hero 扩字段：talentPoints(number,=level-1初始0)/learnedTalents(Record<nodeId,rank>)/spentPoints(number)。
- 重置逻辑函数：resetTalents(hero) → 清空 learnedTalents，talentPoints+=spentPoints。

### R4 战士技能（怒气消耗）
- Skill 接口加字段：rageCost(number,被动=0)/branch?(关联天赋分支)。
- WARRIOR_SKILLS 常量：3-4 主动技能（如 重击rage30/旋风斩rage50/战吼rage40/破甲rage20）+ 2 被动。
- Hero 初始 skills 用 WARRIOR_SKILLS 子集。

### R5 关卡定义 3 关
- MonsterDef/LevelDef/WaveDef 接口（见父 design.md）。
- LEVELS[3] 常量，数值见父 design.md 关卡数值表。
- 每关 4 波：wave1-3 小怪，wave4 boss。
- 首通奖励：关卡1(10钻+1勋章)/关卡2(20钻+1勋章)/关卡3(30钻+1勋章)。

### R6 回合制纯逻辑
- TurnState/TurnAction/TurnResult 接口。
- runTurn(state, action) 纯函数：player action 结算 → enemy AI action 结算 → 返回 newState。
- 怒气系统：攻击+10/受击+15/防御+20，上限100。
- 速度先手：首回合 phase 由 hero.stats.agility vs monster.speed 决定。
- AI 策略：怒气≥技能cost则用最高cost技能，否则攻击。
- 波次推进逻辑：敌人HP≤0 → 下一波或 win；英雄HP≤0 → lose。
- 战斗结算：calcBattleReward(state, level) → {gold,exp,gems?,badge?,equipment?}，首通判定。

### R7 存档扩展
- PlayerSave 加：resources:Resources/talentPoints/learnedTalents/levelProgress:Record<levelId,{cleared,stars}>。
- version 升 2。loadGame 降级兼容：version<2 补默认 resources/talent/levelProgress。

### R8 DEFAULT 更新
- DEFAULT_HERO 加 talentPoints:0/learnedTalents:{}/skills:WARRIOR_SKILLS初始子集。
- DEFAULT_RESOURCES:{gold:0,exp:0,gems:0,badge:0}。

## Acceptance Criteria

- [ ] `pnpm --filter @darkloop/shared build` 通过。
- [ ] `pnpm typecheck` 通过（含 client 引用）。
- [ ] Rarity 7 档枚举 + 配色/权重就位，Mythic/Apex 权重 0。
- [ ] 4 资源类型 + 产出常量就位。
- [ ] WARRIOR_TALENT_TREE 3 分支各 5-6 节点，requires 链完整无环。
- [ ] WARRIOR_SKILLS 4 主动+2 被动，含 rageCost。
- [ ] LEVELS[3] 数据完整，每关 4 波，数值符合 design.md 表。
- [ ] runTurn 纯函数可单测：给定 state+action 返回正确 newState。
- [ ] calcBattleReward 首通/重复通奖励区分正确。
- [ ] PlayerSave version:2 字段齐全，降级兼容。

## Out of Scope

- client UI（ui-layout-nav 子任务）。
- 战斗渲染组件（turn-based-combat 子任务）。
- simulateCombat 保留不删（离线预留）。
- Mage/Ranger 技能/天赋（仅战士）。
