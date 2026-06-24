/**
 * 战斗计算逻辑 - 客户端/服务端共享
 * 保证离线挂机和实时战斗的计算结果一致
 */

import type {
  Hero, PrimaryStats, DerivedStats, Equipment, Monster, CombatResult, CombatLogEntry, Reward,
  DamageInstance, DamageResult, Affix,
} from '../types';
import { Rarity } from '../types';
import { GAME_BALANCE } from '../constants/balance';

// ─── 属性聚合 ─────────────────────────────────────────

const PRIMARY_KEYS: (keyof PrimaryStats)[] = ['strength', 'agility', 'intelligence', 'vitality', 'spirit', 'luck'];
const DERIVED_KEYS: (keyof DerivedStats)[] = [
  'maxHp', 'maxResource', 'physicalAttack', 'rangedAttack', 'magicAttack',
  'armor', 'magicResist', 'critRate', 'critDamage', 'accuracy', 'evade',
  'blockRate', 'blockValue', 'blockPercent', 'armorPierce', 'magicPierce',
  'physicalLeech', 'magicLeech', 'hpRegen', 'resourceRegen', 'cooldownReduction',
  'statusResist', 'damageReflect', 'speed',
];

function isPrimaryStatKey(key: string): key is keyof PrimaryStats {
  return (PRIMARY_KEYS as string[]).includes(key);
}

function isDerivedStatKey(key: string): key is keyof DerivedStats {
  return (DERIVED_KEYS as string[]).includes(key);
}

/** 聚合英雄基础属性（base + 装备 baseStats + 词缀基础属性 + 宠物） */
export function calcCombinedPrimary(hero: Hero): PrimaryStats {
  const combined = { ...hero.stats };
  for (const eq of hero.equipment) {
    for (const [k, v] of Object.entries(eq.baseStats)) {
      if (isPrimaryStatKey(k)) combined[k] += v as number;
    }
    for (const affix of eq.affixes) {
      if (isPrimaryStatKey(affix.stat)) {
        combined[affix.stat] += affix.value;
      }
    }
  }
  for (const pet of hero.petSlots) {
    for (const [k, v] of Object.entries(pet.stats)) {
      if (isPrimaryStatKey(k)) combined[k] += v as number;
    }
  }
  return combined;
}

/**
 * 计算二级属性（基础属性 + 装备 + 词缀 + 等级加成）
 * 英雄和怪物共用此函数（怪物 equipment 传空数组）
 */
export function calcDerivedStats(base: PrimaryStats, equipment: Equipment[], level: number): DerivedStats {
  const S = GAME_BALANCE.STAT_SCALARS;
  const D = GAME_BALANCE.DERIVED_BASE;
  const combined = { ...base };

  // 聚合装备 baseStats + 基础属性词缀
  for (const eq of equipment) {
    for (const [k, v] of Object.entries(eq.baseStats)) {
      if (isPrimaryStatKey(k)) combined[k] += v as number;
    }
    for (const affix of eq.affixes) {
      if (isPrimaryStatKey(affix.stat)) {
        combined[affix.stat] += affix.value;
      }
    }
  }

  // 按标量计算二级属性
  const derived: DerivedStats = {
    maxHp: D.maxHp + combined.vitality * S.VIT_TO_MAX_HP,
    maxResource: D.maxResource,
    physicalAttack: D.physicalAttack + combined.strength * S.STR_TO_PHYSICAL_ATTACK,
    rangedAttack: D.rangedAttack + combined.agility * S.AGI_TO_RANGED_ATTACK,
    magicAttack: D.magicAttack + combined.intelligence * S.INT_TO_MAGIC_ATTACK,
    armor: D.armor + combined.vitality * S.VIT_TO_ARMOR,
    magicResist: D.magicResist + combined.intelligence * S.INT_TO_MAGIC_RESIST,
    critRate: D.critRate + combined.agility * S.AGI_TO_CRIT_RATE,
    critDamage: D.critDamage,
    accuracy: D.accuracy,
    evade: D.evade + combined.agility * S.AGI_TO_EVADE,
    blockRate: D.blockRate,
    blockValue: D.blockValue + combined.strength * S.STR_TO_BLOCK_VALUE,
    blockPercent: D.blockPercent,
    armorPierce: D.armorPierce,
    magicPierce: D.magicPierce,
    physicalLeech: D.physicalLeech,
    magicLeech: D.magicLeech,
    hpRegen: D.hpRegen + combined.vitality * S.VIT_TO_HP_REGEN,
    resourceRegen: D.resourceRegen + combined.spirit * S.SPI_TO_RESOURCE_REGEN,
    cooldownReduction: D.cooldownReduction,
    statusResist: D.statusResist + combined.spirit * S.SPI_TO_STATUS_RESIST,
    damageReflect: D.damageReflect,
    speed: D.speed + combined.agility * S.AGI_TO_SPEED,
  };

  // 聚合二级属性词缀
  for (const eq of equipment) {
    for (const affix of eq.affixes) {
      if (isDerivedStatKey(affix.stat)) {
        derived[affix.stat] += affix.value;
      }
    }
  }

  // 等级加成（每级 +5% 攻防血）
  const levelBonus = 1 + (level - 1) * 0.05;
  derived.maxHp = Math.floor(derived.maxHp * levelBonus);
  derived.physicalAttack = Math.floor(derived.physicalAttack * levelBonus);
  derived.rangedAttack = Math.floor(derived.rangedAttack * levelBonus);
  derived.magicAttack = Math.floor(derived.magicAttack * levelBonus);
  derived.armor = Math.floor(derived.armor * levelBonus);
  derived.magicResist = Math.floor(derived.magicResist * levelBonus);

  // 上限
  derived.critRate = Math.min(derived.critRate, GAME_BALANCE.CRIT_RATE_CAP);
  derived.evade = Math.min(derived.evade, GAME_BALANCE.EVADE_CAP);
  derived.blockPercent = Math.min(derived.blockPercent, GAME_BALANCE.BLOCK_PERCENT_CAP);
  derived.statusResist = Math.min(derived.statusResist, GAME_BALANCE.STATUS_RESIST_CAP);

  return derived;
}

/** 便捷：计算英雄二级属性 */
export function calcHeroDerived(hero: Hero): DerivedStats {
  return calcDerivedStats(hero.stats, hero.equipment, hero.level);
}

/** 向后兼容：聚合基础属性（旧名） */
export function calcFinalStats(hero: Hero): PrimaryStats {
  return calcCombinedPrimary(hero);
}

// ─── 伤害公式 ─────────────────────────────────────────

/**
 * 核心伤害计算：命中 → 暴击 → 格挡 → 减伤 → 穿透 → 元素加成
 */
export function calcDamage(
  attacker: DerivedStats,
  defender: DerivedStats,
  instance: DamageInstance,
  defenderTags?: string[],
): DamageResult {
  // 1. 命中判定
  const hitChance = attacker.accuracy / (attacker.accuracy + defender.evade);
  if (Math.random() > hitChance) {
    return { amount: 0, isCrit: false, isBlocked: false, isHit: false };
  }

  // 2. 暴击
  const isCrit = Math.random() < attacker.critRate;
  let amount = instance.amount * (isCrit ? attacker.critDamage : 1);

  // 3. 格挡
  const isBlocked = Math.random() < defender.blockRate;

  // 4. 减伤源
  const isPhysical = instance.category === 'physical';
  let defense = isPhysical ? defender.armor : defender.magicResist;
  const pierce = isPhysical ? attacker.armorPierce : attacker.magicPierce;
  const K = isPhysical ? GAME_BALANCE.ARMOR_K : GAME_BALANCE.MAGIC_RESIST_K;

  // 5. 穿透
  if (pierce > 0) {
    defense = defense * (1 - Math.min(pierce, 1));
  }

  // 6. 减伤公式: defense / (defense + K)
  const reduction = defense / (defense + K);
  amount = amount * (1 - reduction);

  // 7. 格挡减伤
  if (isBlocked) {
    amount = amount * (1 - defender.blockPercent);
    amount = Math.max(0, amount - defender.blockValue);
  }

  // 8. 元素加成（holy vs undead）
  if (instance.element === 'holy' && defenderTags?.includes('undead')) {
    amount *= (1 + GAME_BALANCE.HOLY_UNDEAD_BONUS);
  }

  return { amount: Math.floor(amount), isCrit, isBlocked, isHit: true };
}

/** 物理伤害（含随机浮动，用于 simulateCombat 等简化场景） */
export function calcPhysicalDamage(derived: DerivedStats): number {
  const variance = 1 + (Math.random() - 0.5) * GAME_BALANCE.DAMAGE_VARIANCE;
  return Math.floor(derived.physicalAttack * variance);
}

/** 法术伤害（含随机浮动） */
export function calcMagicDamage(derived: DerivedStats): number {
  const variance = 1 + (Math.random() - 0.5) * GAME_BALANCE.DAMAGE_VARIANCE;
  return Math.floor(derived.magicAttack * variance);
}

/** 暴击判定 */
export function rollCrit(derived: DerivedStats): { isCrit: boolean; multiplier: number } {
  const isCrit = Math.random() < derived.critRate;
  return { isCrit, multiplier: isCrit ? derived.critDamage : 1 };
}

/** 承受伤害计算（基于 armor/magicResist 减伤曲线） */
export function calcDamageReduction(rawDamage: number, armor: number, isMagic = false): number {
  const K = isMagic ? GAME_BALANCE.MAGIC_RESIST_K : GAME_BALANCE.ARMOR_K;
  const reduction = armor / (armor + K);
  return Math.floor(rawDamage * (1 - reduction));
}

// ─── 单次战斗模拟（离线挂机预留） ──────────────────────

export function simulateCombat(hero: Hero, monster: Monster): CombatResult {
  const heroDerived = calcHeroDerived(hero);
  const monsterDerived = calcDerivedStats(monster.baseStats, [], monster.level);
  const log: CombatLogEntry[] = [];
  const rewards: Reward[] = [];

  let heroHp = heroDerived.maxHp;
  const heroMaxHp = heroHp;
  let monsterHp = monsterDerived.maxHp;
  let timestamp = 0;

  const heroInterval = 1000;
  const monsterInterval = 1000;
  let nextHeroAttack = 0;
  let nextMonsterAttack = 0;

  while (heroHp > 0 && monsterHp > 0 && timestamp < GAME_BALANCE.MAX_COMBAT_DURATION) {
    if (timestamp >= nextHeroAttack) {
      const { isCrit, multiplier } = rollCrit(heroDerived);
      const raw = calcPhysicalDamage(heroDerived);
      const dmg = calcDamageReduction(raw * multiplier, monsterDerived.armor);
      monsterHp -= dmg;
      log.push({ timestamp, type: isCrit ? 'skill' : 'attack', source: hero.name, target: monster.name, value: dmg });
      nextHeroAttack = timestamp + heroInterval;
    }
    if (timestamp >= nextMonsterAttack && monsterHp > 0) {
      const raw = calcPhysicalDamage(monsterDerived);
      const dmg = calcDamageReduction(raw, heroDerived.armor);
      heroHp -= dmg;
      log.push({ timestamp, type: 'damage', source: monster.name, target: hero.name, value: dmg });
      nextMonsterAttack = timestamp + monsterInterval;
    }
    timestamp += GAME_BALANCE.COMBAT_TICK_MS;
  }

  const defeated = monsterHp <= 0;
  if (defeated) {
    for (const loot of monster.lootTable) {
      if (Math.random() < loot.dropRate) {
        rewards.push({
          type: loot.type as Reward['type'],
          amount: loot.quantity ? randomInt(loot.quantity[0], loot.quantity[1]) : 1,
        });
      }
    }
  }

  return {
    duration: timestamp,
    heroHpRemaining: Math.max(0, heroHp),
    monsterDefeated: defeated,
    rewards,
    log,
  };
}

// ─── 离线收益计算 ─────────────────────────────────────

export function calcOfflineReward(
  hero: Hero,
  monster: Monster,
  offlineSeconds: number,
  buildingBonuses: { offlineRate: number; expBonus: number; dropRate: number },
): { gold: number; exp: number; kills: number } {
  const heroDerived = calcHeroDerived(hero);
  const monsterDerived = calcDerivedStats(monster.baseStats, [], monster.level);
  const heroDps = heroDerived.physicalAttack;
  const monsterEhp = monsterDerived.maxHp;

  const killsPerSecond = Math.max(0.1, heroDps / monsterEhp);
  const totalKills = Math.floor(killsPerSecond * offlineSeconds);

  const goldPerKill = GAME_BALANCE.BASE_GOLD_PER_KILL * monster.level;
  const expPerKill = GAME_BALANCE.BASE_EXP_PER_KILL * monster.level;

  return {
    gold: Math.floor(totalKills * goldPerKill * (1 + buildingBonuses.offlineRate)),
    exp: Math.floor(totalKills * expPerKill * (1 + buildingBonuses.expBonus)),
    kills: totalKills,
  };
}

// ─── 工具函数 ─────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getAffixCount(rarity: Rarity): number {
  switch (rarity) {
    case Rarity.Common: return 0;
    case Rarity.Fine: return randomInt(1, 2);
    case Rarity.Rare: return randomInt(2, 4);
    case Rarity.Epic: return randomInt(3, 5);
    case Rarity.Legendary: return randomInt(4, 6);
    case Rarity.Mythic: return randomInt(5, 7);
    case Rarity.Apex: return randomInt(6, 8);
    default: return 0;
  }
}
