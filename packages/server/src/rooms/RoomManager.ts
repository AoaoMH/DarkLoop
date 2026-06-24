/**
 * 房间管理器 - 多人联机基础设施
 *
 * 设计理念：
 * - 单人游戏 = 私人房间（1人）
 * - 多人副本 = 公开房间（N人）
 * - 所有游戏逻辑都在房间内运行，保证一致性
 */

import { Server as SocketServer } from 'socket.io';
import type { EntityId, PlayerSave } from '@shared/types';
import { ServerEvent } from '@shared/types';
import { generateEquipment } from '@shared/logic';

interface RoomMember {
  socketId: string;
  playerId: string;
  playerData: PlayerSave;
}

interface Room {
  id: EntityId;
  members: Map<string, RoomMember>;
  createdAt: number;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerRooms = new Map<string, string>(); // playerId -> roomId

  constructor(private io: SocketServer) {}

  /** 创建私人房间（单人游戏） */
  createPrivateRoom(playerId: string, playerData: PlayerSave): string {
    const roomId = `solo_${playerId}`;
    const room: Room = {
      id: roomId,
      members: new Map(),
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    this.playerRooms.set(playerId, roomId);
    return roomId;
  }

  /** 玩家加入房间 */
  joinRoom(roomId: string, socketId: string, playerId: string, playerData: PlayerSave): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.members.set(socketId, { socketId, playerId, playerData });
    this.playerRooms.set(playerId, roomId);
  }

  /** 玩家离开房间 */
  leaveRoom(socketId: string): void {
    for (const [roomId, room] of this.rooms) {
      if (room.members.has(socketId)) {
        const member = room.members.get(socketId)!;
        room.members.delete(socketId);
        this.playerRooms.delete(member.playerId);

        // 空房间自动清理
        if (room.members.size === 0 && roomId.startsWith('solo_')) {
          this.rooms.delete(roomId);
        }
        break;
      }
    }
  }

  /** 获取玩家所在房间 */
  getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  /** 向房间内所有成员广播消息 */
  broadcastToRoom(roomId: string, event: ServerEvent, data: unknown): void {
    this.io.to(roomId).emit(event, data);
  }

  /** 获取房间数量统计 */
  getStats(): { totalRooms: number; totalPlayers: number } {
    let totalPlayers = 0;
    for (const room of this.rooms.values()) {
      totalPlayers += room.members.size;
    }
    return { totalRooms: this.rooms.size, totalPlayers };
  }
}
