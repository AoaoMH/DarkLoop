/**
 * DarkLoop 游戏服务端入口
 * Fastify + Socket.IO
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { config } from './config.js';
import { playerRoutes } from './routes/index.js';
import { RoomManager } from './rooms/RoomManager.js';
import { ServerEvent } from '@shared/types';

async function main() {
  const app = Fastify({ logger: true });

  // CORS
  await app.register(cors, { origin: config.cors.origin });

  // 路由
  await app.register(playerRoutes);

  // 健康检查
  app.get('/api/health', async () => ({ status: 'ok', version: '0.1.0' }));

  // Socket.IO (用于多人联机)
  const io = new SocketServer(app.server, {
    cors: { origin: config.cors.origin, methods: ['GET', 'POST'] },
  });

  const roomManager = new RoomManager(io);

  io.on('connection', (socket) => {
    app.log.info(`Socket connected: ${socket.id}`);

    // 加入私人房间
    socket.on(ServerEvent.JoinRoom, (data: { roomId: string; playerId: string }) => {
      socket.join(data.roomId);
      app.log.info(`Player ${data.playerId} joined room ${data.roomId}`);
    });

    // 离开
    socket.on('disconnect', () => {
      roomManager.leaveRoom(socket.id);
      app.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // 启动
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`DarkLoop server running at http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
