const redis = require('../redis');
const { getRoom } = require('../services/roomService');
const { getPlayers, getPlayer, updatePlayer, toPublicPlayers } = require('../services/playerService');
const { registerRoomHandlers } = require('./roomHandlers');
const { registerGameHandlers } = require('./gameHandlers');
const { registerHostHandlers } = require('./hostHandlers');
const logger = require('../utils/logger');

function initSockets(io) {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Register all event handlers
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerHostHandlers(io, socket);

    // Handle disconnection
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      try {
        const mapping = await redis.get(`socket:${socket.id}`);
        if (!mapping) return;

        // Host disconnection — just clean up the socket key
        if (mapping.startsWith('HOST:')) {
          await redis.del(`socket:${socket.id}`);
          return;
        }

        const [roomId, playerId] = mapping.split(':');
        if (!roomId || !playerId) {
          await redis.del(`socket:${socket.id}`);
          return;
        }

        const room = await getRoom(roomId);
        if (!room) {
          await redis.del(`socket:${socket.id}`);
          return;
        }

        // Mark player offline
        const player = await getPlayer(roomId, playerId);
        if (player) {
          await updatePlayer(roomId, playerId, { isOnline: false });

          // Don't overwrite game_over data — finished rooms don't need room_updated
          if (room.status !== 'finished') {
            const players = await getPlayers(roomId);
            const publicPlayers = toPublicPlayers(players);
            io.to(roomId).emit('room_updated', {
              players: publicPlayers,
              status: room.status,
              round: room.round,
              currentSpeakerId: room.currentSpeakerId,
            });
          }

          logger.info(`Player ${player.name} (${playerId}) went offline in room ${roomId}`);
        }

        // Clean up socket mapping but keep socketmap entry (for reconnection detection)
        await redis.del(`socket:${socket.id}`);
      } catch (err) {
        logger.error('disconnect handler error:', err);
      }
    });
  });
}

module.exports = { initSockets };
