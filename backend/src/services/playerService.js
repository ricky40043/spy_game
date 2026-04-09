const redis = require('../redis');
const logger = require('../utils/logger');

/**
 * Get all players in a room as an array of objects.
 */
async function getPlayers(roomId) {
  const data = await redis.hgetall(`room:${roomId}:players`);
  if (!data) return [];
  return Object.values(data).map((v) => JSON.parse(v));
}

/**
 * Get a single player by playerId.
 * Returns null if not found.
 */
async function getPlayer(roomId, playerId) {
  const data = await redis.hget(`room:${roomId}:players`, playerId);
  if (!data) return null;
  return JSON.parse(data);
}

/**
 * Add a new player to the room.
 */
async function addPlayer(roomId, playerData) {
  await redis.hset(`room:${roomId}:players`, playerData.playerId, JSON.stringify(playerData));
}

/**
 * Update specific fields on a player record.
 */
async function updatePlayer(roomId, playerId, fields) {
  const current = await getPlayer(roomId, playerId);
  if (!current) throw new Error(`Player ${playerId} not found in room ${roomId}`);
  const updated = { ...current, ...fields };
  await redis.hset(`room:${roomId}:players`, playerId, JSON.stringify(updated));
  return updated;
}

/**
 * Update multiple players at once via pipeline.
 */
async function updatePlayers(roomId, updates) {
  // updates: array of { playerId, fields }
  const pipeline = redis.pipeline();
  for (const { playerId, player } of updates) {
    pipeline.hset(`room:${roomId}:players`, playerId, JSON.stringify(player));
  }
  await pipeline.exec();
}

/**
 * Reset hasVotedFor to null for all players (used after each vote round).
 */
async function resetVotes(roomId) {
  const players = await getPlayers(roomId);
  const pipeline = redis.pipeline();
  for (const p of players) {
    const updated = { ...p, hasVotedFor: null };
    pipeline.hset(`room:${roomId}:players`, p.playerId, JSON.stringify(updated));
  }
  await pipeline.exec();
}

/**
 * Build a public-safe player list (omit role/word for playing state).
 * Reveal all info in finished state.
 */
function toPublicPlayers(players, reveal = false) {
  return players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    isAlive: p.isAlive,
    isOnline: p.isOnline,
    hasVoted: p.hasVotedFor !== null,
    ...(reveal ? { role: p.role, word: p.word } : {}),
  }));
}

module.exports = { getPlayers, getPlayer, addPlayer, updatePlayer, updatePlayers, resetVotes, toPublicPlayers };
