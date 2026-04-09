const redis = require('../redis');
const config = require('../config');
const { generateRoomCode } = require('../utils/roomCode');
const logger = require('../utils/logger');

const ROOM_TTL = config.roomTtl;
const FINISHED_TTL = config.finishedRoomTtl;

/**
 * Create a new room in Redis.
 * Returns the roomId or throws on failure.
 */
async function createRoom(hostId) {
  let roomId = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const exists = await redis.exists(`room:${code}`);
    if (!exists) {
      roomId = code;
      break;
    }
  }
  if (!roomId) {
    throw new Error('Unable to generate unique room code after 5 attempts');
  }

  const now = Date.now().toString();
  const pipeline = redis.pipeline();

  pipeline.hset(`room:${roomId}`, {
    status: 'waiting',
    settings: JSON.stringify({ spyCount: 1, blankCount: 0, civilianCount: 0 }),
    words: JSON.stringify({ civilianWord: null, spyWord: null }),
    hostId,
    round: '0',
    currentSpeakerId: '',
    spokenThisRound: JSON.stringify([]),
    usedWordIds: JSON.stringify([]),
    tieCandidates: JSON.stringify([]),
    createdAt: now,
  });
  pipeline.expire(`room:${roomId}`, ROOM_TTL);

  // Store host identity separately
  pipeline.set(`host:${roomId}`, hostId, 'EX', ROOM_TTL);

  await pipeline.exec();

  logger.info(`Room created: ${roomId} by host ${hostId}`);
  return roomId;
}

/**
 * Get all fields of a room hash as an object.
 * Returns null if room doesn't exist.
 */
async function getRoom(roomId) {
  const data = await redis.hgetall(`room:${roomId}`);
  if (!data || Object.keys(data).length === 0) return null;

  return {
    ...data,
    settings: JSON.parse(data.settings || '{}'),
    words: JSON.parse(data.words || '{}'),
    spokenThisRound: JSON.parse(data.spokenThisRound || '[]'),
    usedWordIds: JSON.parse(data.usedWordIds || '[]'),
    tieCandidates: JSON.parse(data.tieCandidates || '[]'),
    round: parseInt(data.round || '0', 10),
  };
}

/**
 * Patch specific fields on the room hash.
 * Serializes arrays/objects to JSON automatically.
 */
async function updateRoom(roomId, fields) {
  const toSet = {};
  for (const [k, v] of Object.entries(fields)) {
    toSet[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
  }
  await redis.hset(`room:${roomId}`, toSet);
}

/**
 * Set the room TTL to the finished (short) TTL.
 */
async function expireRoomSoon(roomId) {
  await redis.expire(`room:${roomId}`, FINISHED_TTL);
  await redis.expire(`room:${roomId}:players`, FINISHED_TTL);
  await redis.expire(`room:${roomId}:votes`, FINISHED_TTL);
  await redis.expire(`room:${roomId}:socketmap`, FINISHED_TTL);
  await redis.expire(`host:${roomId}`, FINISHED_TTL);
}

/**
 * Refresh TTL on active rooms.
 */
async function refreshRoomTtl(roomId) {
  await redis.expire(`room:${roomId}`, ROOM_TTL);
  await redis.expire(`room:${roomId}:players`, ROOM_TTL);
  await redis.expire(`room:${roomId}:votes`, ROOM_TTL);
  await redis.expire(`room:${roomId}:socketmap`, ROOM_TTL);
  await redis.expire(`host:${roomId}`, ROOM_TTL);
}

module.exports = { createRoom, getRoom, updateRoom, expireRoomSoon, refreshRoomTtl };
