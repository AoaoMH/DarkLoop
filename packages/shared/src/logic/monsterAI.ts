/**
 * 怪物效用评分AI
 * 对每个可用技能按当前局势评分，选最高分技能（加入随机性避免完全可预测）
 */

import type { EnemyCombatState, TurnState, Skill } from '../types';
import { SkillType } from '../types';

interface SkillScore {
  skill: Skill;
  score: number;
}

/** 默认怪物攻击技能（无技能时使用） */
const DEFAULT_ATTACK: Skill = {
  id: 'mob_default_attack',
  name: '攻击',
  type: SkillType.Active,
  description: '造成 100% 物理伤害',
  cooldown: 0,
  damageMultiplier: 1.0,
  level: 1,
  maxLevel: 1,
  icon: '⚔️',
  rageCost: 0,
  targeting: 'single',
};

/**
 * 选择怪物技能
 * 效用评分：对每个技能按当前局势评分，加入 ±15% 随机性，选最高分
 */
export function selectMonsterSkill(
  enemy: EnemyCombatState,
  state: TurnState,
): Skill {
  const skills = enemy.skills.filter(s => s);
  if (skills.length === 0) {
    return DEFAULT_ATTACK;
  }

  const scores: SkillScore[] = skills.map(skill => ({
    skill,
    score: evaluateUtility(skill, enemy, state),
  }));

  // 加入随机性（±15%）
  for (const s of scores) {
    s.score *= 0.85 + Math.random() * 0.3;
  }

  scores.sort((a, b) => b.score - a.score);
  return scores[0].skill;
}

/**
 * 评估技能效用分数
 */
function evaluateUtility(
  skill: Skill,
  enemy: EnemyCombatState,
  state: TurnState,
): number {
  let score = 0;
  const hpRatio = enemy.hp / enemy.maxHp;

  // 伤害技能：按预期伤害占英雄HP比例评分
  if (skill.damageMultiplier > 0) {
    const baseAtk = enemy.derived.physicalAttack;
    const expectedDmg = baseAtk * skill.damageMultiplier;
    const dmgRatio = expectedDmg / state.heroMaxHp;
    score += dmgRatio * 100;
  }

  // 治疗技能：HP越低评分越高
  if (skill.selfEffects?.some(e => e.kind === 'heal')) {
    const healValue = skill.selfEffects.find(e => e.kind === 'heal')?.value ?? 0;
    score += healValue * (1 - hpRatio) * 200;
    // 满血时不治疗
    if (hpRatio > 0.8) score *= 0.1;
  }

  // 防御技能：低血量时优先
  if (skill.selfEffects?.some(e => ['shield', 'def_up'].includes(e.kind))) {
    if (hpRatio < 0.5) {
      score += (0.5 - hpRatio) * 150;
    } else {
      score *= 0.2;
    }
  }

  // 攻击增益技能：中血量时使用
  if (skill.selfEffects?.some(e => e.kind === 'atk_up')) {
    score += 15;
    if (hpRatio > 0.3 && hpRatio < 0.8) score += 10;
  }

  // 控制技能：按概率评分
  if (skill.effects?.some(e => ['stun', 'paralyse', 'freeze'].includes(e.kind))) {
    score += 25;
    // 英雄高血量时控制更有价值
    if (state.heroHp / state.heroMaxHp > 0.5) score += 10;
  }

  // 减益技能：中等优先级
  if (skill.effects?.some(e => ['def_down', 'atk_down', 'bleed', 'burn', 'poison', 'curse'].includes(e.kind))) {
    score += 20;
  }

  return score;
}
