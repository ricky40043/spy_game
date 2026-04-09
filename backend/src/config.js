const config = {
  port: process.env.PORT || 3001,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  roomTtl: 21600,       // 6 hours
  finishedRoomTtl: 600, // 10 minutes after game ends
  socketTtl: 86400,     // 24 hours
  corsOrigins:
    process.env.NODE_ENV === 'production'
      ? '*'
      : ['http://localhost:5173', 'http://localhost:3001'],
};

module.exports = config;
