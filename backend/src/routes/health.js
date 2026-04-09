const express = require('express');
const router = express.Router();
const redis = require('../redis');

router.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.json({ status: 'ok', redis: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', redis: 'disconnected', message: err.message });
  }
});

module.exports = router;
