/**
 * 战斗桥接器 - Phaser → DOM 单向通知
 * BattleScene 播完终局特效后 emit('battle-end', result)，TurnBattleUI 监听显示结算面板。
 * DOM → Phaser 走 useGameStore.subscribe，不经过此 bridge，保持单向数据流。
 */

import Phaser from 'phaser';

export type BattleEndResult = 'win' | 'lose' | 'flee';

export const battleBridge = new Phaser.Events.EventEmitter();
