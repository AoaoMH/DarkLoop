# data-systems-base 技术设计

## 文件改动清单

| 文件 | 改动 |
|------|------|
| `shared/src/types/index.ts` | Rarity 7档(改名Magic→Fine); 新增 ResourceKind/Resources/TalentNode/TalentTree/TurnState/TurnAction/TurnResult/LevelDef/WaveDef/MonsterDef; Hero 扩字段; PlayerSave 扩字段 |
| `shared/src/constants/equipment.ts` | RARITY_COLORS 重写7色; RARITY_WEIGHTS 重写7档; getAffixCount 引用迁移 |
| `shared/src/constants/resources.ts` | **新建** ResourceKind 常量 + RESOURCES 配置 + 产出常量 |
| `shared/src/constants/talents.ts` | **新建** WARRIOR_TALENT_TREE(3分支各6节点) |
| `shared/src/constants/skills.ts` | **新建** WARRIOR_SKILLS(4主动+2被动) |
| `shared/src/constants/levels.ts` | **新建** LEVELS[3] 关卡数据 |
| `shared/src/constants/defaults.ts` | DEFAULT_HERO 扩天赋/技能; 新增 DEFAULT_RESOURCES |
| `shared/src/constants/balance.ts` | 新增 RAGE 相关常量(RAGE_PER_ATTACK10/RAGE_PER_HIT15/RAGE_PER_BLOCK20/RAGE_MAX100) |
| `shared/src/logic/turnBasedCombat.ts` | **新建** runTurn/calcBattleReward/resetTalents/aiChooseAction 纯函数 |
| `shared/src/logic/combat.ts` | getAffixCount 扩7档(保留 simulateCombat 不动) |
| `shared/src/logic/loot.ts` | generateAffix/generateEquipment 兼容7档 |
| `shared/src/index.ts` | re-export 新增模块 |

## WARRIOR_TALENT_TREE 节点设计（3分支各6节点，tier1-6）

### berserk 狂暴分支（暴击/攻强/怒气）
| tier | id | name | effects | requires |
|------|----|------|---------|----------|
| 1 | ber1 | 蛮力 | strength+3 | - |
| 2 | ber2 | 致命一击 | critRate+0.05 | ber1 |
| 3 | ber3 | 狂怒 | 攻击时额外+5怒气 | ber2 |
| 4 | ber4 | 血腥嗜求 | 暴击伤害+0.3 | ber3 |
| 5 | ber5 | 狂战士之怒 | strength+8 | ber4 |
| 6 | ber6 | 死亡旋风 | 旋风斩伤害+50% | ber5 |

### bulwark 坚壁分支（减伤/血量/防御）
| tier | id | name | effects | requires |
|------|----|------|---------|----------|
| 1 | bul1 | 厚皮 | vitality+3 | - |
| 2 | bul2 | 坚韧 | 减伤+5% | bul1 |
| 3 | bul3 | 盾墙 | 防御时减伤额外+20% | bul2 |
| 4 | bul4 | 生命之源 | vitality+8 | bul3 |
| 5 | bul5 | 钢铁意志 | HP上限+15% | bul4 |
| 6 | bul6 | 不朽之躯 | 受击有20%概率减半 | bul5 |

### warcry 战吼分支（辅助/怒气恢复）
| tier | id | name | effects | requires |
|------|----|------|---------|----------|
| 1 | war1 | 战场敏锐 | agility+3 | - |
| 2 | war2 | 怒气涌动 | 回合开始+5怒气 | war1 |
| 3 | war3 | 鼓舞 | 战吼技能效果+30% | war2 |
| 4 | war4 | 速攻 | agility+8 | war3 |
| 5 | war5 | 战场领袖 | 先手概率+20% | war4 |
| 6 | war6 | 战神降临 | 全属性+5 | war5 |

## WARRIOR_SKILLS 技能设计

| id | name | type | rageCost | branch | effect |
|----|------|------|----------|--------|--------|
| skill_heavy_strike | 重击 | active | 30 | berserk | 物理伤害*1.8 |
| skill_whirlwind | 旋风斩 | active | 50 | berserk | 物理伤害*1.2 必中 |
| skill_war_cry | 战吼 | active | 40 | warcry | 自身怒气+30/下回合攻击+20% |
| skill_armor_break | 破甲 | active | 20 | bulwark | 物理伤害*1.0 + 敌人防御-30% 2回合 |
| skill_toughness | 坚韧体魄 | passive | 0 | bulwark | 永久 vitality+5 |
| skill_berserk_passive | 狂暴本能 | passive | 0 | berserk | 永久 攻击时+5怒气 |

Hero 初始 skills: [skill_heavy_strike, skill_toughness]（其余随天赋解锁）

## LEVELS[3] 关卡数据

### 关卡1 史莱姆平原 (recommendLevel:1)
- wave1-3: 绿史莱姆 Lv1 hp30 atk6 def2 speed5 icon:slime
- wave4: 史莱姆王 Lv2 hp80 atk10 def4 speed6 isBoss icon:slime_king
- firstClearReward: {gems:10, badge:1}
- desc: "新手冒险者的试炼之地，史莱姆成群出没。"

### 关卡2 骸骨墓地 (recommendLevel:3)
- wave1-3: 骷髅兵 Lv3 hp60 atk12 def5 speed8 icon:skeleton
- wave4: 骷髅领主 Lv4 hp150 atk18 def8 speed10 isBoss icon:skeleton_lord
- firstClearReward: {gems:20, badge:1}
- desc: "阴森的墓地中，亡灵战士永不安息。"

### 关卡3 恶魔巢穴 (recommendLevel:5)
- wave1-3: 小恶魔 Lv5 hp110 atk20 def8 speed12 icon:imp
- wave4: 恶魔统领 Lv7 hp280 atk30 def12 speed14 isBoss icon:demon_lord
- firstClearReward: {gems:30, badge:1}
- desc: "深入地底，直面恶魔军团的巢穴。"

## runTurn 状态机伪码

```
runTurn(state, action):
  if state.phase == 'player':
    switch action:
      attack:  dmg=calcPhysicalDamage(hero); enemyHp-=dmg; heroRage+=10
      skill:   if heroRage<skill.rageCost return error; heroRage-=cost; apply skill.effect; enemyHp-=skillDmg
      defend:  heroDefending=true; heroRage+=20
      flee:    roll fleeChance(speed diff); success→state.phase='flee'; fail→pass
    if enemyHp<=0: → nextWave or phase='win'
    else: phase='enemy'
  if state.phase == 'enemy':
    aiAction = aiChooseAction(monster)  // 怪无怒气，简单攻击或boss技能
    if heroDefending: dmg*=0.4
    heroHp-=dmg; heroRage+=15
    heroDefending=false
    if heroHp<=0: phase='lose'
    else: phase='player'
  turnCount++
  return state
```

aiChooseAction：boss 30%概率用技能，否则攻击。小怪纯攻击。

## 文件依赖顺序

types → constants(equipment/resources/balance/talents/skills/levels/defaults) → logic(turnBasedCombat/combat/loot) → index.ts re-export
