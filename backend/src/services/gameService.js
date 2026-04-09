const redis = require('../redis');
const { getRoom, updateRoom, expireRoomSoon } = require('./roomService');
const { getPlayers, getPlayer, updatePlayer, updatePlayers, resetVotes, toPublicPlayers } = require('./playerService');
const { castVote, getVotes, clearVotes, settleVotes } = require('./voteService');
const { pickWordPair } = require('./wordService');
const logger = require('../utils/logger');

/**
 * Assign roles and words to all players, then save to Redis.
 * Returns array of { playerId, role, word } assignments.
 */
async function assignRoles(roomId, players, spyCount, blankCount) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const assignments = [];

  for (let i = 0; i < shuffled.length; i++) {
    let role;
    if (i < spyCount) {
      role = 'spy';
    } else if (i < spyCount + blankCount) {
      role = 'blank';
    } else {
      role = 'civilian';
    }
    assignments.push({ playerId: shuffled[i].playerId, role });
  }
  return assignments;
}

/**
 * Start the game: validate, pick words, assign roles, broadcast.
 * io and socket are passed in for emitting events.
 */
async function startGame(io, socket, roomId, spyCount, blankCount) {
  const room = await getRoom(roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '找不到房間' });
    return;
  }

  // Validate host
  const hostId = await redis.get(`host:${roomId}`);
  const socketMapping = await redis.get(`socket:${socket.id}`);
  if (!socketMapping || !socketMapping.startsWith('HOST:')) {
    socket.emit('error', { code: 'NOT_HOST', message: '只有房主才能開始遊戲' });
    return;
  }
  const [, mappedRoomId, mappedHostId] = socketMapping.split(':');
  if (mappedRoomId !== roomId || mappedHostId !== hostId) {
    socket.emit('error', { code: 'NOT_HOST', message: '只有房主才能開始遊戲' });
    return;
  }

  const players = await getPlayers(roomId);
  const alivePlayers = players.filter((p) => p.isAlive);

  if (alivePlayers.length < 4) {
    socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: '至少需要 4 名玩家' });
    return;
  }

  const sc = parseInt(spyCount, 10) || 1;
  const bc = parseInt(blankCount, 10) || 0;

  if (sc < 1) {
    socket.emit('error', { code: 'INVALID_SETTINGS', message: '至少需要 1 名臥底' });
    return;
  }
  if (bc < 0) {
    socket.emit('error', { code: 'INVALID_SETTINGS', message: '白板數量不能為負數' });
    return;
  }
  if (sc + bc >= alivePlayers.length) {
    socket.emit('error', { code: 'INVALID_SETTINGS', message: '臥底加白板人數不能大於或等於總人數' });
    return;
  }

  // Pick word pair
  const wordPair = pickWordPair(room.usedWordIds);
  if (!wordPair) {
    socket.emit('error', { code: 'NO_WORDS_LEFT', message: '所有題目已用完，請重新開始' });
    return;
  }

  const { civilianWord, spyWord, wordId } = wordPair;
  const usedWordIds = [...room.usedWordIds, wordId];

  // Assign roles
  const roleAssignments = await assignRoles(roomId, alivePlayers, sc, bc);

  // Update player records and emit role_assigned privately
  const pipeline = redis.pipeline();
  for (const assignment of roleAssignments) {
    const player = players.find((p) => p.playerId === assignment.playerId);
    const word = assignment.role === 'spy' ? spyWord : assignment.role === 'blank' ? null : civilianWord;
    const updatedPlayer = {
      ...player,
      role: assignment.role,
      word,
      isAlive: true,
      hasVotedFor: null,
    };
    pipeline.hset(`room:${roomId}:players`, assignment.playerId, JSON.stringify(updatedPlayer));
  }
  await pipeline.exec();

  // Update room state
  const civilianCount = alivePlayers.length - sc - bc;
  await updateRoom(roomId, {
    status: 'playing',
    settings: { spyCount: sc, blankCount: bc, civilianCount },
    words: { civilianWord, spyWord },
    round: 1,
    spokenThisRound: [],
    currentSpeakerId: '',
    usedWordIds,
    tieCandidates: [],
  });

  // Emit role privately to each player's socket
  const updatedPlayers = await getPlayers(roomId);
  for (const player of updatedPlayers) {
    const playerSocket = await findSocketByPlayer(roomId, player.playerId);
    if (playerSocket) {
      io.to(playerSocket).emit('role_assigned', { role: player.role, word: player.word });
    }
  }

  // Broadcast room_updated
  const publicPlayers = toPublicPlayers(updatedPlayers);
  const updatedRoom = await getRoom(roomId);
  io.to(roomId).emit('room_updated', {
    players: publicPlayers,
    status: 'playing',
    round: updatedRoom.round,
    currentSpeakerId: '',
  });

  // Start speaking rounds
  await nextSpeaker(io, roomId);
}

/**
 * Find the socket ID for a given playerId in a room.
 * Scans socket:* keys — in production you'd maintain a reverse index.
 * Here we store a forward index room:{roomId}:socketmap field=playerId value=socketId
 */
async function findSocketByPlayer(roomId, playerId) {
  const socketId = await redis.hget(`room:${roomId}:socketmap`, playerId);
  return socketId || null;
}

/**
 * Determine the next speaker and emit events.
 */
async function nextSpeaker(io, roomId) {
  const room = await getRoom(roomId);
  if (!room) return;

  const players = await getPlayers(roomId);
  const spokenThisRound = room.spokenThisRound;

  // Candidates: alive, online, not yet spoken this round
  const candidates = players.filter(
    (p) => p.isAlive && p.isOnline && !spokenThisRound.includes(p.playerId)
  );

  // Check if all alive players have spoken (regardless of online status)
  const alivePlayers = players.filter((p) => p.isAlive);
  const allAliveSpoken = alivePlayers.every((p) => spokenThisRound.includes(p.playerId));

  if (allAliveSpoken) {
    // All have spoken — start voting
    await startVoting(io, roomId);
    return;
  }

  if (candidates.length === 0) {
    // Some alive players haven't spoken but all are offline — wait
    await updateRoom(roomId, { currentSpeakerId: '' });
    const publicPlayers = toPublicPlayers(players);
    const updatedRoom = await getRoom(roomId);
    io.to(roomId).emit('room_updated', {
      players: publicPlayers,
      status: room.status,
      round: room.round,
      currentSpeakerId: '',
    });
    return;
  }

  // Pick a random candidate
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  await updateRoom(roomId, { currentSpeakerId: chosen.playerId });

  io.to(roomId).emit('speaker_changed', {
    currentSpeakerId: chosen.playerId,
    speakerName: chosen.name,
    spokenThisRound,
  });
}

/**
 * Transition to voting phase.
 */
async function startVoting(io, roomId) {
  const players = await getPlayers(roomId);
  const alivePlayers = players.filter((p) => p.isAlive);

  await updateRoom(roomId, { status: 'voting', currentSpeakerId: '' });

  const candidates = alivePlayers.map((p) => ({ playerId: p.playerId, name: p.name }));
  io.to(roomId).emit('voting_started', { candidates });
}

/**
 * Handle a player's vote.
 */
async function handleVote(io, socket, roomId, targetPlayerId) {
  const socketMapping = await redis.get(`socket:${socket.id}`);
  if (!socketMapping || socketMapping.startsWith('HOST:')) {
    socket.emit('error', { code: 'INVALID_VOTE', message: '無法識別投票者' });
    return;
  }

  const [, playerId] = socketMapping.split(':');
  const room = await getRoom(roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '找不到房間' });
    return;
  }

  if (room.status !== 'voting' && room.status !== 'revoting') {
    socket.emit('error', { code: 'NOT_VOTING', message: '目前不在投票階段' });
    return;
  }

  const voter = await getPlayer(roomId, playerId);
  if (!voter) {
    socket.emit('error', { code: 'PLAYER_NOT_FOUND', message: '找不到玩家' });
    return;
  }
  if (!voter.isAlive) {
    socket.emit('error', { code: 'PLAYER_DEAD', message: '已淘汰的玩家不能投票' });
    return;
  }
  if (voter.hasVotedFor !== null) {
    socket.emit('error', { code: 'ALREADY_VOTED', message: '你已經投過票了' });
    return;
  }

  const target = await getPlayer(roomId, targetPlayerId);
  if (!target || !target.isAlive) {
    socket.emit('error', { code: 'INVALID_TARGET', message: '目標玩家不存在或已淘汰' });
    return;
  }

  // For revoting, target must be in tieCandidates
  if (room.status === 'revoting') {
    if (!room.tieCandidates.includes(targetPlayerId)) {
      socket.emit('error', { code: 'INVALID_TARGET', message: '重新投票時只能投平票候選人' });
      return;
    }
  }

  // Record vote
  await updatePlayer(roomId, playerId, { hasVotedFor: targetPlayerId });
  await castVote(roomId, targetPlayerId);

  // Broadcast who has voted (no target revealed yet)
  io.to(roomId).emit('vote_received', { voterId: playerId });

  // Broadcast updated room (who has voted)
  const players = await getPlayers(roomId);
  const publicPlayers = toPublicPlayers(players);
  io.to(roomId).emit('room_updated', {
    players: publicPlayers,
    status: room.status,
    round: room.round,
    currentSpeakerId: room.currentSpeakerId,
  });

  // Check if all alive players have voted
  const updatedPlayers = await getPlayers(roomId);
  const alivePlayers = updatedPlayers.filter((p) => p.isAlive);
  const allVoted = alivePlayers.every((p) => p.hasVotedFor !== null);

  if (allVoted) {
    // Reveal vote counts to everyone before processing elimination
    const votes = await getVotes(roomId);
    io.to(roomId).emit('vote_results', { votes });
    // 2-second pause so players can see the results
    await new Promise((r) => setTimeout(r, 2000));
    await processVoteResults(io, roomId);
  }
}

/**
 * Process vote results after all alive players have voted.
 */
async function processVoteResults(io, roomId) {
  const result = await settleVotes(roomId);

  if (result.eliminated) {
    const eliminated = await getPlayer(roomId, result.eliminated);
    await updatePlayer(roomId, result.eliminated, { isAlive: false });
    await clearVotes(roomId);

    io.to(roomId).emit('player_eliminated', {
      playerId: eliminated.playerId,
      name: eliminated.name,
      role: eliminated.role,
      word: eliminated.word,
    });

    await checkWinCondition(io, roomId);
  } else if (result.tied && result.tied.length > 0) {
    // Tie — enter revoting
    await startRevote(io, roomId, result.tied);
  } else {
    // No votes at all — shouldn't happen but handle gracefully
    logger.warn(`No votes recorded for room ${roomId}, skipping to next round`);
    await advanceRound(io, roomId);
  }
}

/**
 * Start a revote among tied candidates.
 */
async function startRevote(io, roomId, tieCandidates) {
  await clearVotes(roomId);
  await resetVotes(roomId);

  const players = await getPlayers(roomId);
  const candidateDetails = tieCandidates
    .map((id) => players.find((p) => p.playerId === id))
    .filter(Boolean)
    .map((p) => ({ playerId: p.playerId, name: p.name }));

  // Make tie candidates re-speak before revote
  await updateRoom(roomId, {
    status: 'revoting',
    tieCandidates,
    spokenThisRound: [],
    currentSpeakerId: '',
  });

  io.to(roomId).emit('revote_started', {
    tieCandidates: candidateDetails,
    reason: 'tie',
  });

  // Start speaking for tie candidates only
  await nextSpeakerRevote(io, roomId);
}

/**
 * Next speaker during revote — only among tieCandidates.
 */
async function nextSpeakerRevote(io, roomId) {
  const room = await getRoom(roomId);
  if (!room) return;

  const players = await getPlayers(roomId);
  const spokenThisRound = room.spokenThisRound;

  // Candidates: alive, online, in tieCandidates, not yet spoken
  const candidates = players.filter(
    (p) =>
      p.isAlive &&
      p.isOnline &&
      room.tieCandidates.includes(p.playerId) &&
      !spokenThisRound.includes(p.playerId)
  );

  // Check if all tie candidates have spoken
  const allTieSpoken = room.tieCandidates
    .filter((id) => players.find((p) => p.playerId === id && p.isAlive))
    .every((id) => spokenThisRound.includes(id));

  if (allTieSpoken) {
    // Everyone in tie has spoken — now vote again
    await triggerRevoteVoting(io, roomId);
    return;
  }

  if (candidates.length === 0) {
    // All tie candidates are offline — skip speaking and go to revote
    await triggerRevoteVoting(io, roomId);
    return;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  await updateRoom(roomId, { currentSpeakerId: chosen.playerId });

  io.to(roomId).emit('speaker_changed', {
    currentSpeakerId: chosen.playerId,
    speakerName: chosen.name,
    spokenThisRound,
  });
}

/**
 * Transition to voting phase during revote.
 */
async function triggerRevoteVoting(io, roomId) {
  const room = await getRoom(roomId);
  const players = await getPlayers(roomId);

  const tieCandidates = room.tieCandidates
    .map((id) => players.find((p) => p.playerId === id && p.isAlive))
    .filter(Boolean)
    .map((p) => ({ playerId: p.playerId, name: p.name }));

  await updateRoom(roomId, { currentSpeakerId: '' });

  io.to(roomId).emit('voting_started', { candidates: tieCandidates });
}

/**
 * Check win condition after an elimination.
 */
async function checkWinCondition(io, roomId) {
  const players = await getPlayers(roomId);
  const room = await getRoom(roomId);

  const aliveSpies = players.filter((p) => p.isAlive && p.role === 'spy').length;
  const aliveNonSpies = players.filter((p) => p.isAlive && (p.role === 'civilian' || p.role === 'blank')).length;

  let winner = null;
  if (aliveSpies === 0) {
    winner = 'civilian';
  } else if (aliveSpies >= aliveNonSpies) {
    winner = 'spy';
  }

  if (winner) {
    await updateRoom(roomId, { status: 'finished' });
    await expireRoomSoon(roomId);

    io.to(roomId).emit('game_over', {
      winner,
      players: players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        role: p.role,
        word: p.word,
        isAlive: p.isAlive,
      })),
    });

    logger.info(`Game over in room ${roomId}: ${winner} wins`);
  } else {
    // Advance to next round
    await advanceRound(io, roomId);
  }
}

/**
 * Start the next round of speaking.
 */
async function advanceRound(io, roomId) {
  const room = await getRoom(roomId);
  const newRound = room.round + 1;

  await clearVotes(roomId);
  await resetVotes(roomId);

  await updateRoom(roomId, {
    status: 'playing',
    round: newRound,
    spokenThisRound: [],
    currentSpeakerId: '',
    tieCandidates: [],
  });

  const players = await getPlayers(roomId);
  const publicPlayers = toPublicPlayers(players);
  io.to(roomId).emit('room_updated', {
    players: publicPlayers,
    status: 'playing',
    round: newRound,
    currentSpeakerId: '',
  });

  await nextSpeaker(io, roomId);
}

/**
 * Handle finish_speaking event.
 */
async function handleFinishSpeaking(io, socket, roomId) {
  const socketMapping = await redis.get(`socket:${socket.id}`);
  if (!socketMapping) {
    socket.emit('error', { code: 'NOT_FOUND', message: '找不到玩家資訊' });
    return;
  }

  // Determine if this is a host or player socket
  let playerId;
  if (socketMapping.startsWith('HOST:')) {
    socket.emit('error', { code: 'NOT_PLAYER', message: 'Host 無法發言' });
    return;
  } else {
    [, playerId] = socketMapping.split(':');
  }

  const room = await getRoom(roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '找不到房間' });
    return;
  }

  if (room.status !== 'playing' && room.status !== 'revoting') {
    socket.emit('error', { code: 'WRONG_STATUS', message: '目前不在發言階段' });
    return;
  }

  // Strict check: only current speaker can call finish_speaking
  if (room.currentSpeakerId !== playerId) {
    socket.emit('error', { code: 'NOT_CURRENT_SPEAKER', message: '你不是當前發言者' });
    return;
  }

  const spokenThisRound = [...room.spokenThisRound, playerId];
  await updateRoom(roomId, { spokenThisRound, currentSpeakerId: '' });

  if (room.status === 'revoting') {
    await nextSpeakerRevote(io, roomId);
  } else {
    await nextSpeaker(io, roomId);
  }
}

/**
 * Handle kick_player event (host only).
 */
async function handleKickPlayer(io, socket, roomId, targetPlayerId) {
  const socketMapping = await redis.get(`socket:${socket.id}`);
  if (!socketMapping || !socketMapping.startsWith('HOST:')) {
    socket.emit('error', { code: 'NOT_HOST', message: '只有房主才能踢人' });
    return;
  }

  const [, mappedRoomId, mappedHostId] = socketMapping.split(':');
  const hostId = await redis.get(`host:${roomId}`);
  if (mappedRoomId !== roomId || mappedHostId !== hostId) {
    socket.emit('error', { code: 'NOT_HOST', message: '只有房主才能踢人' });
    return;
  }

  const target = await getPlayer(roomId, targetPlayerId);
  if (!target) {
    socket.emit('error', { code: 'PLAYER_NOT_FOUND', message: '找不到目標玩家' });
    return;
  }

  await updatePlayer(roomId, targetPlayerId, { isAlive: false });

  io.to(roomId).emit('player_eliminated', {
    playerId: target.playerId,
    name: target.name,
    role: target.role,
    word: target.word,
  });

  const room = await getRoom(roomId);

  // If the kicked player was speaking, advance speaker
  if (room.currentSpeakerId === targetPlayerId) {
    if (room.status === 'revoting') {
      await nextSpeakerRevote(io, roomId);
    } else {
      await nextSpeaker(io, roomId);
    }
  }

  await checkWinCondition(io, roomId);
}

/**
 * Host forces the start of a new speaking round (same roles, same words).
 */
async function forceNextRound(io, socket, roomId) {
  const socketMapping = await redis.get(`socket:${socket.id}`);
  if (!socketMapping || !socketMapping.startsWith('HOST:')) {
    socket.emit('error', { code: 'NOT_HOST', message: '只有房主才能執行此操作' });
    return;
  }
  const room = await getRoom(roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '找不到房間' });
    return;
  }
  await advanceRound(io, roomId);
}

/**
 * Host forces the game to end immediately.
 */
async function forceEndGame(io, socket, roomId) {
  const socketMapping = await redis.get(`socket:${socket.id}`);
  if (!socketMapping || !socketMapping.startsWith('HOST:')) {
    socket.emit('error', { code: 'NOT_HOST', message: '只有房主才能執行此操作' });
    return;
  }
  const room = await getRoom(roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '找不到房間' });
    return;
  }

  await updateRoom(roomId, { status: 'finished' });
  await expireRoomSoon(roomId);

  const players = await getPlayers(roomId);
  io.to(roomId).emit('game_over', {
    winner: 'draw',
    players: players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      role: p.role,
      word: p.word,
      isAlive: p.isAlive,
    })),
  });
  logger.info(`Game force-ended by host in room ${roomId}`);
}

module.exports = {
  startGame,
  handleVote,
  handleFinishSpeaking,
  handleKickPlayer,
  nextSpeaker,
  findSocketByPlayer,
  forceNextRound,
  forceEndGame,
};
