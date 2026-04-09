const redis = require('../redis');
const logger = require('../utils/logger');

const VOTES_KEY = (roomId) => `room:${roomId}:votes`;

/**
 * Atomically increment the vote count for a target player.
 */
async function castVote(roomId, targetPlayerId) {
  await redis.hincrby(VOTES_KEY(roomId), targetPlayerId, 1);
}

/**
 * Get all votes as { playerId: count } map.
 */
async function getVotes(roomId) {
  const data = await redis.hgetall(VOTES_KEY(roomId));
  if (!data) return {};
  const result = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = parseInt(v, 10);
  }
  return result;
}

/**
 * Delete the votes hash (start fresh).
 */
async function clearVotes(roomId) {
  await redis.del(VOTES_KEY(roomId));
}

/**
 * Determine the result of the current vote.
 * Returns { eliminated: playerId } or { tied: [playerId, ...] }
 */
async function settleVotes(roomId) {
  const votes = await getVotes(roomId);
  if (Object.keys(votes).length === 0) {
    return { tied: [] };
  }

  const maxVotes = Math.max(...Object.values(votes));
  const topPlayers = Object.entries(votes)
    .filter(([, count]) => count === maxVotes)
    .map(([playerId]) => playerId);

  if (topPlayers.length === 1) {
    return { eliminated: topPlayers[0] };
  }
  return { tied: topPlayers };
}

module.exports = { castVote, getVotes, clearVotes, settleVotes };
