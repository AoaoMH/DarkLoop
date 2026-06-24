/**
 * 资源货币系统常量
 */

import { ResourceKind, type Resources } from '../types';

export const RESOURCE_META: Record<ResourceKind, { name: string; iconClass: string; color: string; desc: string }> = {
  [ResourceKind.Gold]: {
    name: '金币',
    iconClass: 'sprite-icon icon-gold',
    color: '#ffd700',
    desc: '战斗掉落、卖装备获得，基础流通货币',
  },
  [ResourceKind.Exp]: {
    name: '经验',
    iconClass: 'sprite-icon icon-exp',
    color: '#7fffd4',
    desc: '战斗掉落，升级角色，每级获得 1 天赋点',
  },
  [ResourceKind.Gems]: {
    name: '钻石',
    iconClass: 'sprite-icon icon-gems',
    color: '#00bfff',
    desc: '关卡首通/成就获得，高级货币（预留消耗场景）',
  },
  [ResourceKind.Badge]: {
    name: '冒险勋章',
    iconClass: 'sprite-icon icon-badge',
    color: '#ff8c00',
    desc: '关卡首通获得，消耗以解锁更高难度（养成维度）',
  },
};

export const DEFAULT_RESOURCES: Resources = {
  gold: 0,
  exp: 0,
  gems: 0,
  badge: 0,
};

// 关卡首通奖励默认值（被 LEVELS 覆盖）
export const FIRST_CLEAR_REWARD_DEFAULT = {
  gems: 10,
  badge: 1,
};
