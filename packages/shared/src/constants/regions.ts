/**
 * 大地区与关卡定义
 * 3 个大地区 × 10 关卡，关卡显示为 1-1 ~ 3-10
 * 每区域模式：1~4关=2波小怪+1波精英，5关=Boss，6~9关=更高等级循环，10关=Boss(+随从)
 */

import type { RegionDef, LevelDef, WaveDef } from '../types';

// ── 辅助函数 ─────────────────────────────────────────

function mkWave(...monsters: [string, number][]): WaveDef {
  return { monsters: monsters.map(([templateId, level]) => ({ templateId, level })) };
}

function mkLevel(
  regionId: string,
  stageNum: number,
  recommendLevel: number,
  waves: WaveDef[],
  reward?: { gems?: number; badge?: number },
): LevelDef {
  return {
    id: `${regionId === 'region_1' ? '1' : regionId === 'region_2' ? '2' : '3'}-${stageNum}`,
    regionId,
    stageNum,
    name: `${regionId === 'region_1' ? '1' : regionId === 'region_2' ? '2' : '3'}-${stageNum}`,
    desc: '',
    recommendLevel,
    waves,
    firstClearReward: { gems: reward?.gems ?? 10, badge: reward?.badge ?? 1 },
  };
}

// ── 区域1：史莱姆平原 ─────────────────────────────────

const region1Levels: LevelDef[] = [
  // 1-1 ~ 1-4: 2波小怪 + 1波精英
  mkLevel('region_1', 1, 1, [
    mkWave(['slime_green', 1], ['slime_green', 1]),
    mkWave(['slime_blue', 2]),
  ], { gems: 10 }),
  mkLevel('region_1', 2, 1, [
    mkWave(['slime_green', 1], ['giant_rat', 1]),
    mkWave(['slime_blue', 2]),
  ], { gems: 10 }),
  mkLevel('region_1', 3, 2, [
    mkWave(['slime_green', 2], ['bat', 2]),
    mkWave(['slime_green', 2], ['giant_rat', 2]),
    mkWave(['slime_blue', 3]),
  ], { gems: 15 }),
  mkLevel('region_1', 4, 2, [
    mkWave(['bat', 2], ['bat', 2], ['slime_green', 2]),
    mkWave(['slime_blue', 3], ['slime_green', 3]),
  ], { gems: 15 }),
  // 1-5: Boss 单独战
  mkLevel('region_1', 5, 3, [
    mkWave(['slime_king', 3]),
  ], { gems: 30 }),
  // 1-6 ~ 1-9: 更高等级循环
  mkLevel('region_1', 6, 3, [
    mkWave(['slime_green', 3], ['bat', 3]),
    mkWave(['giant_rat', 3], ['slime_green', 3]),
    mkWave(['slime_blue', 4]),
  ], { gems: 20 }),
  mkLevel('region_1', 7, 3, [
    mkWave(['bat', 3], ['bat', 3], ['bat', 3]),
    mkWave(['slime_blue', 4]),
  ], { gems: 20 }),
  mkLevel('region_1', 8, 4, [
    mkWave(['slime_green', 4], ['slime_green', 4], ['giant_rat', 4]),
    mkWave(['slime_blue', 5]),
  ], { gems: 25 }),
  mkLevel('region_1', 9, 4, [
    mkWave(['slime_blue', 5], ['bat', 4]),
    mkWave(['slime_green', 4], ['giant_rat', 4]),
    mkWave(['slime_blue', 5]),
  ], { gems: 25 }),
  // 1-10: Boss + 随从
  mkLevel('region_1', 10, 5, [
    mkWave(['slime_king', 5], ['slime_green', 4], ['slime_green', 4]),
  ], { gems: 50 }),
];

// ── 区域2：骸骨墓地 ─────────────────────────────────

const region2Levels: LevelDef[] = [
  mkLevel('region_2', 1, 6, [
    mkWave(['skeleton', 6], ['skeleton', 6]),
    mkWave(['skeleton_archer', 7]),
  ], { gems: 20 }),
  mkLevel('region_2', 2, 6, [
    mkWave(['skeleton', 6], ['zombie', 6]),
    mkWave(['skeleton_archer', 7]),
  ], { gems: 20 }),
  mkLevel('region_2', 3, 7, [
    mkWave(['skeleton', 7], ['bat', 7], ['zombie', 7]),
    mkWave(['skeleton_archer', 8]),
  ], { gems: 25 }),
  mkLevel('region_2', 4, 7, [
    mkWave(['zombie', 7], ['zombie', 7], ['skeleton', 7]),
    mkWave(['skeleton_archer', 8], ['skeleton', 8]),
  ], { gems: 25 }),
  // 2-5: Boss
  mkLevel('region_2', 5, 8, [
    mkWave(['skeleton_lord', 8]),
  ], { gems: 40 }),
  mkLevel('region_2', 6, 8, [
    mkWave(['skeleton', 8], ['zombie', 8]),
    mkWave(['skeleton', 8], ['bat', 8]),
    mkWave(['skeleton_archer', 9]),
  ], { gems: 30 }),
  mkLevel('region_2', 7, 9, [
    mkWave(['zombie', 9], ['zombie', 9], ['skeleton', 9]),
    mkWave(['skeleton_archer', 9]),
  ], { gems: 30 }),
  mkLevel('region_2', 8, 9, [
    mkWave(['skeleton', 9], ['skeleton', 9], ['bat', 9]),
    mkWave(['skeleton_archer', 10]),
  ], { gems: 35 }),
  mkLevel('region_2', 9, 10, [
    mkWave(['skeleton_archer', 10], ['zombie', 10]),
    mkWave(['skeleton', 10], ['skeleton', 10]),
    mkWave(['skeleton_archer', 10]),
  ], { gems: 35 }),
  // 2-10: Boss + 随从
  mkLevel('region_2', 10, 10, [
    mkWave(['skeleton_lord', 10], ['skeleton_archer', 10], ['skeleton', 10]),
  ], { gems: 60 }),
];

// ── 区域3：恶魔巢穴 ─────────────────────────────────

const region3Levels: LevelDef[] = [
  mkLevel('region_3', 1, 11, [
    mkWave(['imp', 11], ['imp', 11]),
    mkWave(['hellhound', 12]),
  ], { gems: 30 }),
  mkLevel('region_3', 2, 11, [
    mkWave(['imp', 11], ['hellhound', 11]),
    mkWave(['demon_brute', 12]),
  ], { gems: 30 }),
  mkLevel('region_3', 3, 12, [
    mkWave(['imp', 12], ['imp', 12], ['demon_caster', 12]),
    mkWave(['demon_brute', 13]),
  ], { gems: 35 }),
  mkLevel('region_3', 4, 12, [
    mkWave(['hellhound', 12], ['hellhound', 12], ['imp', 12]),
    mkWave(['demon_caster', 13], ['imp', 13]),
  ], { gems: 35 }),
  // 3-5: Boss
  mkLevel('region_3', 5, 13, [
    mkWave(['demon_lord', 13]),
  ], { gems: 50 }),
  mkLevel('region_3', 6, 13, [
    mkWave(['imp', 13], ['demon_caster', 13]),
    mkWave(['hellhound', 13], ['imp', 13]),
    mkWave(['demon_brute', 14]),
  ], { gems: 40 }),
  mkLevel('region_3', 7, 14, [
    mkWave(['hellhound', 14], ['hellhound', 14], ['imp', 14]),
    mkWave(['demon_brute', 14]),
  ], { gems: 40 }),
  mkLevel('region_3', 8, 14, [
    mkWave(['demon_caster', 14], ['imp', 14], ['imp', 14]),
    mkWave(['demon_brute', 15]),
  ], { gems: 45 }),
  mkLevel('region_3', 9, 15, [
    mkWave(['demon_brute', 15], ['demon_caster', 15]),
    mkWave(['hellhound', 15], ['hellhound', 15]),
    mkWave(['demon_brute', 15]),
  ], { gems: 45 }),
  // 3-10: Boss + 随从
  mkLevel('region_3', 10, 15, [
    mkWave(['demon_lord', 15], ['demon_caster', 15], ['hellhound', 15]),
  ], { gems: 80 }),
];

// ── 导出 ─────────────────────────────────────────

export const REGIONS: RegionDef[] = [
  {
    id: 'region_1',
    name: '史莱姆平原',
    desc: '新手冒险者的试炼之地，史莱姆成群出没。',
    theme: 'forest',
    levels: region1Levels,
  },
  {
    id: 'region_2',
    name: '骸骨墓地',
    desc: '阴森的墓地中，亡灵战士永不安息。',
    theme: 'graveyard',
    levels: region2Levels,
  },
  {
    id: 'region_3',
    name: '恶魔巢穴',
    desc: '深入地底，直面恶魔军团的巢穴。',
    theme: 'hell',
    levels: region3Levels,
  },
];

/** 所有关卡的平铺数组 */
export const LEVELS: LevelDef[] = REGIONS.flatMap(r => r.levels);

/** 根据 ID 获取关卡 */
export function getLevelById(id: string): LevelDef | undefined {
  return LEVELS.find(l => l.id === id);
}

/** 根据关卡 ID 获取所属区域 */
export function getRegionByLevelId(levelId: string): RegionDef | undefined {
  return REGIONS.find(r => r.levels.some(l => l.id === levelId));
}

/** 根据关卡 ID 获取所属区域 ID */
export function getRegionIdByLevelId(levelId: string): string | undefined {
  const region = getRegionByLevelId(levelId);
  return region?.id;
}

/** 检查区域是否已解锁（前一区域最后一关已通关） */
export function isRegionUnlocked(
  regionId: string,
  levelProgress: Record<string, { cleared: boolean }>,
): boolean {
  const idx = REGIONS.findIndex(r => r.id === regionId);
  if (idx <= 0) return true; // 第一个区域默认解锁
  const prevRegion = REGIONS[idx - 1];
  const lastLevel = prevRegion.levels[prevRegion.levels.length - 1];
  return !!levelProgress[lastLevel.id]?.cleared;
}

/** 检查关卡是否已解锁（前一关已通关，或本区域第一关且区域已解锁） */
export function isLevelUnlocked(
  levelId: string,
  levelProgress: Record<string, { cleared: boolean }>,
): boolean {
  const level = getLevelById(levelId);
  if (!level) return false;
  // 第一关：检查区域解锁
  if (level.stageNum === 1) {
    return isRegionUnlocked(level.regionId, levelProgress);
  }
  // 非第一关：前一关必须通关
  const prevStageNum = level.stageNum - 1;
  const region = REGIONS.find(r => r.id === level.regionId);
  const prevLevel = region?.levels.find(l => l.stageNum === prevStageNum);
  if (!prevLevel) return false;
  return !!levelProgress[prevLevel.id]?.cleared;
}
