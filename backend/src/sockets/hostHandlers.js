const { startGame, handleKickPlayer } = require('../services/gameService');
const logger = require('../utils/logger');

/**
 * Register host-only socket event handlers.
 */
function registerHostHandlers(io, socket) {
  /**
   * start_game: Host starts the game with settings.
   * Payload: { roomId, spyCount, blankCount }
   */
  socket.on('start_game', async ({ roomId, spyCount, blankCount } = {}) => {
    try {
      if (!roomId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少 roomId' });
        return;
      }
      await startGame(io, socket, roomId, spyCount ?? 1, blankCount ?? 0);
    } catch (err) {
      logger.error('start_game error:', err);
      socket.emit('error', { code: 'START_GAME_FAILED', message: err.message });
    }
  });

  /**
   * kick_player: Host removes a player from the game.
   * Payload: { roomId, targetPlayerId }
   */
  socket.on('kick_player', async ({ roomId, targetPlayerId } = {}) => {
    try {
      if (!roomId || !targetPlayerId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少必要欄位' });
        return;
      }
      await handleKickPlayer(io, socket, roomId, targetPlayerId);
    } catch (err) {
      logger.error('kick_player error:', err);
      socket.emit('error', { code: 'KICK_PLAYER_FAILED', message: err.message });
    }
  });
}

module.exports = { registerHostHandlers };
