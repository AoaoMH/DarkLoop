/**
 * 怪物属性缩放
 * 将 MonsterTemplate + level 转换为 EnemyCombatState（运行时实例）
 */

import type { MonsterTemplate, EnemyCombatState, PrimaryStats } from '../types';
import { calcDerivedStats } from './combat';
import { SKILL_MAP } from '../constants/skills';

const PRIMARY_KEYS: (keyof PrimaryStats)[] = [
  'strength', 'agility', 'intelligence', 'vitality', 'spirit', 'luck',
];

let uidCounter = 0;

export function scaleMonster(template: MonsterTemplate, level: number): EnemyCombatState {
  // 1. 按成长率缩放基础属性
  const stats: PrimaryStats = { ...template.baseStats };
  const diff = level - 1;
  for (const key of PRIMARY_KEYS) {
    const growth = template.statGrowth[key] ?? 0;
    stats[key] = Math.floor(stats[key] + growth * diff);
  }

  // 2. 计算二级属性（怪物不应用 5% 等级加成，成长率已覆盖缩放）
  const derived = calcDerivedStats(stats, [], level, false);

  // 3. 加载技能实例
  const skills = template.skills
    .map(id => SKILL_MAP[id])
    .filter((s): s is NonNullable<typeof s> => !!s);

  // 4. 生成唯一 UID
  uidCounter += 1;
  const uid = `${template.id}_${level}_${uidCounter}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    uid,
    templateId: template.id,
    name: template.name,
    icon: template.icon,
    level,
    hp: derived.maxHp,
    maxHp: derived.maxHp,
    derived,
    tags: [...template.tags],
    isBoss: !!template.isBoss,
    isElite: !!template.isElite,
    buffs: [],
    alive: true,
    skills,
    loot: template.loot,
  };
}

/** 从波次定义批量生成敌人实例 */
export function scaleWaveMonsters(
  waveMonsters: { templateId: string; level: number }[],
  templates: Record<string, MonsterTemplate>,
): EnemyCombatState[] {
  return waveMonsters.map(m => {
    const template = templates[m.templateId];
    if (!template) {
      throw new Error(`Monster template not found: ${m.templateId}`);
    }
    return scaleMonster(template, m.level);
  });
}
