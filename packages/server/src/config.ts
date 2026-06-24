/**
 * 服务端配置
 */

export const config = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '0.0.0.0',

  // 数据库 (SQLite 用于开发，生产环境可切换 PostgreSQL)
  database: {
    url: process.env.DATABASE_URL || 'file:./darkloop.db',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'darkloop-dev-secret-change-in-production',
    expiresIn: '7d',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // 游戏平衡参数覆盖（可选，服务端可动态调整）
  balanceOverrides: {},
};
