/**
 * 默认值配置
 */

import { BuildingType, HeroClass, type Building, type Hero, type HeroStats, type Resources } from '../types';
import { DEFAULT_RESOURCES } from './resources';
import { WARRIOR_SKILLS, WARRIOR_STARTER_SKILL_IDS } from './skills';

export const DEFAULT_HERO_STATS: HeroStats = {
  strength: 10,
  agility: 10,
  intelligence: 10,
  vitality: 10,
  spirit: 10,
  luck: 10,
};

export { DEFAULT_RESOURCES };

export const DEFAULT_BUILDINGS: Building[] = [
  {
    type: BuildingType.Blacksmith,
    level: 1,
    maxLevel: 20,
    effects: [{ type: 'drop_rate', value: 0.05 }],
  },
  {
    type: BuildingType.AlchemyLab,
    level: 1,
    maxLevel: 20,
    effects: [{ type: 'offline_rate', value: 0.1 }],
  },
  {
    type: BuildingType.TrainingGround,
    level: 1,
    maxLevel: 20,
    effects: [{ type: 'exp_bonus', value: 0.1 }],
  },
  {
    type: BuildingType.PetHouse,
    level: 1,
    maxLevel: 20,
    effects: [{ type: 'pet_exp', value: 0.1 }],
  },
];

export function createDefaultHero(name = '勇者'): Hero {
  const starterSkills = WARRIOR_SKILLS.filter(s => WARRIOR_STARTER_SKILL_IDS.includes(s.id));
  return {
    id: crypto.randomUUID(),
    name,
    class: HeroClass.Warrior,
    level: 1,
    exp: 0,
    stats: { ...DEFAULT_HERO_STATS },
    equipment: [],
    skills: starterSkills,
    petSlots: [],
    talentPoints: 10,
    spentPoints: 0,
    learnedTalents: {},
  };
}
