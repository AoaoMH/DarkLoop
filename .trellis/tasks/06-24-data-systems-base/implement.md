# data-systems-base 执行计划

## 有序清单

### Step 1: types 改造 (`shared/src/types/index.ts`)
- [ ] Rarity 改 7 档：`Common|Fine|Rare|Epic|Legendary|Mythic|Apex`（Magic→Fine）
- [ ] 新增 `ResourceKind{Gold,Exp,Gems,Badge}` + `Resources{gold,exp,gems,badge}`
- [ ] 新增 `TalentNode{TalentBranch}` + `TalentTree` + `LearnedTalents=Record<string,number>`
- [ ] Skill 加 `rageCost:number` + `branch?:TalentBranch`
- [ ] Hero 加 `talentPoints:number` + `spentPoints:number` + `learnedTalents:LearnedTalents`
- [ ] 新增 `MonsterDef`/`WaveDef`/`LevelDef`/`LevelProgress`
- [ ] 新增 `TurnState`/`TurnAction`/`TurnResult`/`BattlePhase`
- [ ] PlayerSave 加 `resources:Resources` + `levelProgress:Record<string,LevelProgress>` + version 升 2
- **验证**: `pnpm --filter @darkloop/shared build`

### Step 2: equipment.ts 重写 (`shared/src/constants/equipment.ts`)
- [ ] RARITY_COLORS 7 色（白绿蓝紫橙红+炫彩渐变）
- [ ] RARITY_WEIGHTS 7 档（Mythic0/Apex0）
- [ ] 全量 grep 替换 `Magic`→`Fine`（types 已改，constants 跟进）
- **验证**: `pnpm typecheck`（修复所有引用报错）

### Step 3: 新建常量文件
- [ ] `constants/resources.ts`: ResourceKind 常量 + RESOURCES 元数据(名/图标/色)
- [ ] `constants/balance.ts` 加 RAGE 常量: RAGE_PER_ATTACK10/RAGE_PER_HIT15/RAGE_PER_BLOCK20/RAGE_MAX100
- [ ] `constants/talents.ts`: WARRIOR_TALENT_TREE(3分支×6节点，按 design.md 表)
- [ ] `constants/skills.ts`: WARRIOR_SKILLS(4主动+2被动，按 design.md 表)
- [ ] `constants/levels.ts`: LEVELS[3](4波/关，按 design.md 数据)
- **验证**: `pnpm --filter @darkloop/shared build`

### Step 4: defaults.ts 更新 (`shared/src/constants/defaults.ts`)
- [ ] DEFAULT_HERO 加 talentPoints:0/spentPoints:0/learnedTalents:{}/skills:[skill_heavy_strike,skill_toughness]
- [ ] 新增 DEFAULT_RESOURCES:{gold:0,exp:0,gems:0,badge:0}
- **验证**: `pnpm --filter @darkloop/shared build`

### Step 5: turnBasedCombat.ts 新建 (`shared/src/logic/turnBasedCombat.ts`)
- [ ] `runTurn(state, action): TurnState` 纯函数（按 design.md 伪码）
- [ ] `aiChooseAction(monster, isBoss): TurnAction`
- [ ] `calcBattleReward(state, level, isFirstClear): Reward`
- [ ] `resetTalents(hero): Hero`（清 learnedTalents，还点数）
- [ ] `initTurnState(hero, wave): TurnState`（建初始战斗状态）
- **验证**: `pnpm --filter @darkloop/shared build`

### Step 6: combat.ts / loot.ts 兼容
- [ ] combat.ts `getAffixCount` 扩 7 档（Mythic5-7/Apex6-8）
- [ ] loot.ts `generateAffix`/`generateEquipment` 兼容 7 档（rollRarity 已按权重，Mythic/Apex权重0不产出）
- **验证**: `pnpm --filter @darkloop/shared build`

### Step 7: index.ts re-export
- [ ] `shared/src/index.ts` 加 export resources/talents/skills/levels/turnBasedCombat
- **验证**: `pnpm --filter @darkloop/shared build` + `pnpm typecheck`（全量）

### Step 8: 全量验证
- [ ] `pnpm typecheck` 通过
- [ ] grep 确认无遗留 `Magic`（稀有度语境）引用
- [ ] grep 确认所有新导出可被 client 引用

## 验证命令

```bash
pnpm --filter @darkloop/shared build   # 每 step 后
pnpm typecheck                         # step2/7 后全量
```

## 回滚点

- 每 Step 一个 commit（实现阶段才 commit，本任务规划不提交）
- Step2（Rarity改名）是最高风险点：若 typecheck 报错过多，可先 revert types+equipment 再逐步替换
