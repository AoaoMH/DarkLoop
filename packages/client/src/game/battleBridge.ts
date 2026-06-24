/**
 * 战斗桥接器 - Phaser ↔ DOM 双向通信
 *
 * Phaser → DOM:
 *   'battle-end'       — 终局结果
 *   'target-selected'  — 玩家点击精灵选择了目标 (uid)
 *
 * DOM → Phaser:
 *   'target-request'   — 进入选目标模式 (pendingSkillId | null for basic attack)
 *   'target-cancel'    — 取消选目标模式
 */

import Phaser from 'phaser';

export type BattleEndResult = 'win' | 'lose' | 'flee';

export interface TargetSelectedPayload {
  uid: string;
}

export interface TargetRequestPayload {
  /** null = 普攻选目标, string = 技能ID */
  pendingSkillId: string | null;
}

export const battleBridge = new Phaser.Events.EventEmitter();
