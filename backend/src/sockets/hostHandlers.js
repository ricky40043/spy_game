const { startGame, handleKickPlayer, forceNextRound, forceEndGame } = require('../services/gameService');
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
  /**
   * force_next_round: Host restarts speaking phase (same roles/words, next round number).
   * Payload: { roomId }
   */
  socket.on('force_next_round', async ({ roomId } = {}) => {
    try {
      if (!roomId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少 roomId' });
        return;
      }
      await forceNextRound(io, socket, roomId);
    } catch (err) {
      logger.error('force_next_round error:', err);
      socket.emit('error', { code: 'FORCE_NEXT_ROUND_FAILED', message: err.message });
    }
  });

  /**
   * force_end_game: Host ends the game immediately (draw).
   * Payload: { roomId }
   */
  socket.on('force_end_game', async ({ roomId } = {}) => {
    try {
      if (!roomId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少 roomId' });
        return;
      }
      await forceEndGame(io, socket, roomId);
    } catch (err) {
      logger.error('force_end_game error:', err);
      socket.emit('error', { code: 'FORCE_END_GAME_FAILED', message: err.message });
    }
  });
}

module.exports = { registerHostHandlers };
