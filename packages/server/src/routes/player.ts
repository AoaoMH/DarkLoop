/**
 * 玩家相关路由
 */

import type { FastifyInstance } from 'fastify';
import type { PlayerSave } from '@shared/types';

export async function playerRoutes(app: FastifyInstance) {
  // 获取玩家存档
  app.get('/api/player/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // TODO: 从数据库查询
    // const player = await prisma.player.findUnique({ where: { id } });
    // if (!player) return reply.status(404).send({ error: 'Player not found' });

    // 临时返回空数据
    return { id, saveData: null };
  });

  // 保存玩家存档
  app.post('/api/player/:id/save', async (request, reply) => {
    const { id } = request.params as { id: string };
    const saveData = request.body as PlayerSave;

    // TODO: 存入数据库
    // await prisma.player.upsert({
    //   where: { id },
    //   update: { saveData: JSON.stringify(saveData) },
    //   create: { id, username: id, saveData: JSON.stringify(saveData), password: '' },
    // });

    app.log.info(`Player ${id} saved, stage: ${saveData.stage}`);
    return { success: true };
  });

  // 计算离线收益
  app.post('/api/player/:id/offline-reward', async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: 使用 shared/logic 中的 calcOfflineReward 计算
    return { gold: 0, exp: 0, kills: 0 };
  });
}
