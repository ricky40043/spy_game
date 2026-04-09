const { handleVote, handleFinishSpeaking } = require('../services/gameService');
const logger = require('../utils/logger');

/**
 * Register game-play socket event handlers (non-host actions).
 */
function registerGameHandlers(io, socket) {
  /**
   * finish_speaking: Current speaker signals they are done.
   * Payload: { roomId }
   */
  socket.on('finish_speaking', async ({ roomId } = {}) => {
    try {
      if (!roomId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少 roomId' });
        return;
      }
      await handleFinishSpeaking(io, socket, roomId);
    } catch (err) {
      logger.error('finish_speaking error:', err);
      socket.emit('error', { code: 'FINISH_SPEAKING_FAILED', message: err.message });
    }
  });

  /**
   * vote: Player casts their vote.
   * Payload: { roomId, targetPlayerId }
   */
  socket.on('vote', async ({ roomId, targetPlayerId } = {}) => {
    try {
      if (!roomId || !targetPlayerId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少必要欄位' });
        return;
      }
      await handleVote(io, socket, roomId, targetPlayerId);
    } catch (err) {
      logger.error('vote error:', err);
      socket.emit('error', { code: 'VOTE_FAILED', message: err.message });
    }
  });
}

module.exports = { registerGameHandlers };
