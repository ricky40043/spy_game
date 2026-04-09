const redis = require('../redis');
const config = require('../config');
const { createRoom, getRoom, updateRoom, refreshRoomTtl } = require('../services/roomService');
const { getPlayers, getPlayer, addPlayer, updatePlayer, toPublicPlayers } = require('../services/playerService');
const { findSocketByPlayer, nextSpeaker } = require('../services/gameService');
const logger = require('../utils/logger');

/**
 * Register room-related socket event handlers.
 */
function registerRoomHandlers(io, socket) {
  /**
   * rejoin_host: Host reconnects after page refresh.
   * Payload: { roomId, hostId }
   */
  socket.on('rejoin_host', async ({ roomId, hostId } = {}) => {
    try {
      if (!roomId || !hostId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少必要欄位' });
        return;
      }

      const room = await getRoom(roomId);
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '找不到房間（可能已過期）' });
        return;
      }

      const storedHostId = await redis.get(`host:${roomId}`);
      if (storedHostId !== hostId) {
        socket.emit('error', { code: 'NOT_HOST', message: '身分驗證失敗' });
        return;
      }

      // Restore socket mapping
      await redis.set(`socket:${socket.id}`, `HOST:${roomId}:${hostId}`, 'EX', config.socketTtl);
      socket.join(roomId);

      // Push current room state back to host
      const players = await getPlayers(roomId);
      const publicPlayers = toPublicPlayers(players);
      socket.emit('room_updated', {
        players: publicPlayers,
        status: room.status,
        round: room.round,
        currentSpeakerId: room.currentSpeakerId,
      });

      // Re-send phase-specific state
      if (room.status === 'playing' || room.status === 'revoting') {
        if (room.currentSpeakerId) {
          const speaker = await getPlayer(roomId, room.currentSpeakerId);
          socket.emit('speaker_changed', {
            currentSpeakerId: room.currentSpeakerId,
            speakerName: speaker ? speaker.name : '',
            spokenThisRound: room.spokenThisRound,
          });
        }
        if (room.status === 'revoting' && room.tieCandidates?.length) {
          const tieDetails = room.tieCandidates
            .map(id => players.find(p => p.playerId === id))
            .filter(Boolean)
            .map(p => ({ playerId: p.playerId, name: p.name }));
          socket.emit('revote_started', { tieCandidates: tieDetails, reason: 'tie' });
        }
      } else if (room.status === 'voting') {
        const alivePlayers = players.filter(p => p.isAlive);
        socket.emit('voting_started', {
          candidates: alivePlayers.map(p => ({ playerId: p.playerId, name: p.name })),
        });
      } else if (room.status === 'finished') {
        socket.emit('game_over', {
          winner: room.winner || 'draw',
          players: players.map(p => ({
            playerId: p.playerId, name: p.name, role: p.role, word: p.word, isAlive: p.isAlive,
          })),
        });
      }

      logger.info(`Host rejoined room ${roomId}`);
    } catch (err) {
      logger.error('rejoin_host error:', err);
      socket.emit('error', { code: 'REJOIN_HOST_FAILED', message: err.message });
    }
  });

  /**
   * create_room: Host creates a new room.
   * Payload: { hostId }
   */
  socket.on('create_room', async ({ hostId } = {}) => {
    try {
      if (!hostId) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少 hostId' });
        return;
      }

      const roomId = await createRoom(hostId);

      // Map socket -> HOST:{roomId}:{hostId}
      await redis.set(`socket:${socket.id}`, `HOST:${roomId}:${hostId}`, 'EX', config.socketTtl);

      socket.join(roomId);
      socket.emit('room_created', { roomId });
      logger.info(`Socket ${socket.id} created room ${roomId}`);
    } catch (err) {
      logger.error('create_room error:', err);
      socket.emit('error', { code: 'CREATE_ROOM_FAILED', message: err.message });
    }
  });

  /**
   * join_room: Player joins or reconnects to a room.
   * Payload: { roomId, playerId, name }
   */
  socket.on('join_room', async ({ roomId, playerId, name } = {}) => {
    try {
      if (!roomId || !playerId || !name) {
        socket.emit('error', { code: 'MISSING_FIELD', message: '缺少必要欄位' });
        return;
      }

      const room = await getRoom(roomId);
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '找不到房間' });
        return;
      }

      const existingPlayer = await getPlayer(roomId, playerId);

      if (existingPlayer) {
        // --- Reconnection flow ---
        logger.info(`Player ${playerId} reconnecting to room ${roomId}`);

        // Remove old socket mapping
        const oldSocketId = await redis.hget(`room:${roomId}:socketmap`, playerId);
        if (oldSocketId && oldSocketId !== socket.id) {
          await redis.del(`socket:${oldSocketId}`);
        }

        // Update player online status
        await updatePlayer(roomId, playerId, { isOnline: true });

        // Set new socket mapping
        await redis.set(`socket:${socket.id}`, `${roomId}:${playerId}`, 'EX', config.socketTtl);
        await redis.hset(`room:${roomId}:socketmap`, playerId, socket.id);

        socket.join(roomId);

        // Broadcast room_updated
        const players = await getPlayers(roomId);
        const publicPlayers = toPublicPlayers(players);
        const updatedRoom = await getRoom(roomId);

        io.to(roomId).emit('room_updated', {
          players: publicPlayers,
          status: updatedRoom.status,
          round: updatedRoom.round,
          currentSpeakerId: updatedRoom.currentSpeakerId,
        });

        // Re-send private role if game is in progress
        if (updatedRoom.status === 'playing' || updatedRoom.status === 'voting' || updatedRoom.status === 'revoting') {
          socket.emit('role_assigned', {
            role: existingPlayer.role,
            word: existingPlayer.word,
          });

          // Re-send current game state
          if (updatedRoom.status === 'playing' || updatedRoom.status === 'revoting') {
            if (updatedRoom.currentSpeakerId) {
              const speaker = await getPlayer(roomId, updatedRoom.currentSpeakerId);
              socket.emit('speaker_changed', {
                currentSpeakerId: updatedRoom.currentSpeakerId,
                speakerName: speaker ? speaker.name : '',
                spokenThisRound: updatedRoom.spokenThisRound,
              });
            }
          } else if (updatedRoom.status === 'voting') {
            const alivePlayers = players.filter((p) => p.isAlive);
            socket.emit('voting_started', {
              candidates: alivePlayers.map((p) => ({ playerId: p.playerId, name: p.name })),
            });
          }
        }

        // If the player came back online and we were waiting for them to speak
        if (
          updatedRoom.status === 'playing' &&
          !updatedRoom.currentSpeakerId &&
          !updatedRoom.spokenThisRound.includes(playerId)
        ) {
          await nextSpeaker(io, roomId);
        }
      } else {
        // --- New player flow ---
        if (room.status !== 'waiting') {
          socket.emit('error', { code: 'GAME_ALREADY_STARTED', message: '遊戲已開始，無法加入' });
          return;
        }

        const newPlayer = {
          playerId,
          name,
          role: null,
          word: null,
          isAlive: true,
          isOnline: true,
          hasVotedFor: null,
        };

        await addPlayer(roomId, newPlayer);
        await redis.set(`socket:${socket.id}`, `${roomId}:${playerId}`, 'EX', config.socketTtl);
        await redis.hset(`room:${roomId}:socketmap`, playerId, socket.id);

        socket.join(roomId);

        const players = await getPlayers(roomId);
        const publicPlayers = toPublicPlayers(players);

        io.to(roomId).emit('room_updated', {
          players: publicPlayers,
          status: room.status,
          round: room.round,
          currentSpeakerId: room.currentSpeakerId,
        });

        logger.info(`Player ${name} (${playerId}) joined room ${roomId}`);
      }

      await refreshRoomTtl(roomId);
    } catch (err) {
      logger.error('join_room error:', err);
      socket.emit('error', { code: 'JOIN_ROOM_FAILED', message: err.message });
    }
  });
}

module.exports = { registerRoomHandlers };
