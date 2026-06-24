/**
 * 游戏状态管理 - Zustand
 * 管理玩家数据、装备、资源、天赋、战斗状态
 */

import { create } from 'zustand';
import type { Equipment, Hero, PlayerSave, OfflineReward, Building, Resources, LevelProgress, TurnState, LevelDef } from '@shared/types';
import { HeroClass, Rarity, EquipSlot } from '@shared/types';
import { generateEquipment } from '@shared/logic/loot';
import { DEFAULT_BUILDINGS, createDefaultHero } from '@shared/constants/defaults';
import { DEFAULT_RESOURCES } from '@shared/constants/resources';
import { LEVELS } from '@shared/constants/levels';
import { resetTalents, learnTalent, refundTalent, calcHeroMaxHp, initTurnState, runTurn, runEnemyTurn, calcBattleReward } from '@shared/logic/turnBasedCombat';
import type { TurnAction } from '@shared/types';
import { GAME_BALANCE } from '@shared/constants/balance';
import { WARRIOR_SKILLS, WARRIOR_STARTER_SKILL_IDS } from '@shared/constants/skills';

interface GameState {
  hero: Hero | null;
  resources: Resources;
  buildings: Building[];
  inventory: Equipment[];
  levelProgress: Record<string, LevelProgress>;
  stage: number;
  highestStage: number;

  isBattling: boolean;
  currentLevelId: string | null;
  turnState: TurnState | null;
  battleReward: ReturnType<typeof calcBattleReward> | null;

  offlineReward: OfflineReward | null;
  heroLevel: number;

  initGame: () => void;
  addResources: (patch: Partial<Resources>) => void;
  spendResources: (patch: Partial<Resources>) => boolean;
  addToInventory: (item: Equipment) => void;
  equipItem: (item: Equipment, slotIndex: number) => void;
  learnTalentNode: (nodeId: string) => void;
  refundTalentNode: (nodeId: string) => void;
  resetAllTalents: () => void;

  startBattle: (levelId: string) => void;
  playerAction: (action: TurnAction) => void;
  enemyTurn: () => void;
  advanceWave: () => void;
  endBattle: () => void;
  claimBattleReward: () => void;

  saveGame: () => void;
  loadGame: () => boolean;
}

const STORAGE_KEY = 'darkloop_save';
const SAVE_VERSION = 3;

export const useGameStore = create<GameState>((set, get) => ({
  hero: null,
  resources: { ...DEFAULT_RESOURCES },
  buildings: DEFAULT_BUILDINGS,
  inventory: [],
  levelProgress: {},
  stage: 1,
  highestStage: 1,

  isBattling: false,
  currentLevelId: null,
  turnState: null,
  battleReward: null,

  offlineReward: null,
  heroLevel: 1,

  initGame: () => {
    if (get().loadGame()) return;
    const hero = createDefaultHero('冒险者');
    const initialProgress: Record<string, LevelProgress> = {};
    for (const lv of LEVELS) initialProgress[lv.id] = { cleared: false, stars: 0, firstClearClaimed: false };
    
    // 生成一套战士的各稀有度装备（白、绿、蓝、紫、橙、红、彩）用于测试
    const testEquipments = [
      generateEquipment(1, 0, EquipSlot.Weapon, ['universal', 'warrior'], Rarity.Common),
      generateEquipment(1, 0, EquipSlot.Helmet, ['universal', 'warrior'], Rarity.Fine),
      generateEquipment(1, 0, EquipSlot.Armor, ['universal', 'warrior'], Rarity.Rare),
      generateEquipment(1, 0, EquipSlot.Boots, ['universal', 'warrior'], Rarity.Epic),
      generateEquipment(1, 0, EquipSlot.Ring, ['universal', 'warrior'], Rarity.Legendary),
      generateEquipment(1, 0, EquipSlot.Amulet, ['universal', 'warrior'], Rarity.Mythic),
      generateEquipment(1, 0, EquipSlot.Weapon, ['universal', 'warrior'], Rarity.Apex),
    ];

    set({ 
      hero, 
      heroLevel: 1, 
      resources: { ...DEFAULT_RESOURCES, gold: 100 }, 
      levelProgress: initialProgress, 
      stage: 1,
      inventory: testEquipments 
    });
  },

  addResources: (patch) =>
    set((s) => ({
      resources: {
        gold: s.resources.gold + (patch.gold ?? 0),
        exp: s.resources.exp + (patch.exp ?? 0),
        gems: s.resources.gems + (patch.gems ?? 0),
        badge: s.resources.badge + (patch.badge ?? 0),
      },
    })),

  spendResources: (patch) => {
    const { resources } = get();
    for (const [k, v] of Object.entries(patch)) {
      if ((resources[k as keyof Resources] ?? 0) < (v as number)) return false;
    }
    set((s) => ({
      resources: {
        gold: s.resources.gold - (patch.gold ?? 0),
        exp: s.resources.exp - (patch.exp ?? 0),
        gems: s.resources.gems - (patch.gems ?? 0),
        badge: s.resources.badge - (patch.badge ?? 0),
      },
    }));
    return true;
  },

  addToInventory: (item) => set((s) => ({ inventory: [...s.inventory, item] })),

  equipItem: (item, slotIndex) =>
    set((s) => {
      if (!s.hero) return s;
      const newEquipment = [...s.hero.equipment];
      const oldItem = newEquipment[slotIndex];
      newEquipment[slotIndex] = item;
      const newInventory = s.inventory.filter((i) => i.id !== item.id);
      if (oldItem) newInventory.push(oldItem);
      return { hero: { ...s.hero, equipment: newEquipment }, inventory: newInventory };
    }),

  learnTalentNode: (nodeId) =>
    set((s) => {
      if (!s.hero) return s;
      return { hero: learnTalent(s.hero, nodeId) };
    }),

  refundTalentNode: (nodeId) =>
    set((s) => {
      if (!s.hero) return s;
      return { hero: refundTalent(s.hero, nodeId) };
    }),

  resetAllTalents: () =>
    set((s) => {
      if (!s.hero) return s;
      return { hero: resetTalents(s.hero) };
    }),

  startBattle: (levelId) => {
    const { hero, levelProgress } = get();
    if (!hero) return;
    const level = LEVELS.find(l => l.id === levelId);
    if (!level) return;
    const ts = initTurnState(hero, level, 0);
    set({ isBattling: true, currentLevelId: levelId, turnState: ts, battleReward: null });
  },

  playerAction: (action) =>
    set((s) => {
      if (!s.turnState || !s.hero || !s.currentLevelId) return s;
      const level = LEVELS.find(l => l.id === s.currentLevelId);
      if (!level) return s;
      const next = runTurn(s.turnState, s.hero, action);
      if (next.phase === 'flee') {
        return { turnState: next };
      }
      if (next.phase === 'win') {
        const reward = calcBattleReward(s.hero, level, s.levelProgress[level.id]?.cleared ?? false);
        return { turnState: next, battleReward: reward };
      }
      return { turnState: next };
    }),

  enemyTurn: () =>
    set((s) => {
      if (!s.turnState || !s.hero) return s;
      const next = runEnemyTurn(s.turnState, s.hero);
      if (next.phase === 'lose') {
        return { turnState: next };
      }
      return { turnState: next };
    }),

  advanceWave: () =>
    set((s) => {
      if (!s.turnState || !s.hero || !s.currentLevelId) return s;
      const level = LEVELS.find(l => l.id === s.currentLevelId);
      if (!level) return s;
      const nextWaveIdx = s.turnState.waveIndex;
      
      const currentHp = s.turnState.heroHp;
      const currentRage = s.turnState.heroRage;

      const ts = initTurnState(s.hero, level, nextWaveIdx);
      ts.heroHp = Math.min(ts.heroMaxHp, currentHp);
      ts.heroRage = Math.min(ts.heroMaxRage, currentRage);

      const prevLog = s.turnState.log;
      return { turnState: { ...ts, log: prevLog } };
    }),

  endBattle: () => set({ isBattling: false, currentLevelId: null, turnState: null, battleReward: null }),

  claimBattleReward: () => {
    const { battleReward, currentLevelId, levelProgress, hero, resources } = get();
    if (!battleReward || !currentLevelId || !hero) return;
    const newResources = {
      gold: resources.gold + (battleReward.resources.gold ?? 0),
      exp: resources.exp + (battleReward.resources.exp ?? 0),
      gems: resources.gems + (battleReward.resources.gems ?? 0),
      badge: resources.badge + (battleReward.resources.badge ?? 0),
    };
    let newHero = { ...hero };
    let newLevelProgress = { ...levelProgress };
    if (battleReward.isFirstClear) {
      newLevelProgress = {
        ...levelProgress,
        [currentLevelId]: { cleared: true, stars: 3, firstClearClaimed: true },
      };
    } else {
      newLevelProgress = {
        ...levelProgress,
        [currentLevelId]: { ...(levelProgress[currentLevelId] ?? { cleared: false, stars: 0, firstClearClaimed: false }), cleared: true },
      };
    }
    const expTotal = newResources.exp;
    let level = newHero.level;
    let exp = expTotal;
    let talentPoints = newHero.talentPoints;
    while (exp >= GAME_BALANCE.EXP_BASE * Math.pow(GAME_BALANCE.EXP_GROWTH, level - 1)) {
      exp -= Math.floor(GAME_BALANCE.EXP_BASE * Math.pow(GAME_BALANCE.EXP_GROWTH, level - 1));
      level += 1;
      talentPoints += 1;
    }
    const inventoryAdd = battleReward.equipment;
    set({
      resources: { ...newResources, exp },
      hero: { ...newHero, level, talentPoints, exp },
      inventory: [...get().inventory, ...inventoryAdd],
      levelProgress: newLevelProgress,
      heroLevel: level,
      battleReward: null,
      isBattling: false,
      currentLevelId: null,
      turnState: null,
    });
  },

  saveGame: () => {
    const { hero, resources, buildings, levelProgress, stage, highestStage } = get();
    if (!hero) return;
    const save: PlayerSave = {
      version: SAVE_VERSION,
      hero,
      buildings,
      resources,
      levelProgress,
      stage,
      highestStage,
      lastOnlineAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  },

  loadGame: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const save: PlayerSave = JSON.parse(raw);
      if (save.version !== SAVE_VERSION) return false;

      const loadedHero = save.hero;
      if (loadedHero) {
        if (!loadedHero.skills || loadedHero.skills.length === 0) {
          loadedHero.skills = WARRIOR_SKILLS.filter(s => WARRIOR_STARTER_SKILL_IDS.includes(s.id));
        }
      }

      set({
        hero: loadedHero,
        resources: save.resources,
        buildings: save.buildings,
        levelProgress: save.levelProgress,
        stage: save.stage,
        highestStage: save.highestStage,
        heroLevel: loadedHero ? loadedHero.level : 1,
      });
      return true;
    } catch {
      return false;
    }
  },
}));
