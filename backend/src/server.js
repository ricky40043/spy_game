const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const redis = require('./redis');
const healthRouter = require('./routes/health');
const { initSockets } = require('./sockets/index');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());

// API routes
app.use('/api', healthRouter);

// Serve frontend build
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // If frontend not built yet, return a simple message
      res.status(200).json({ message: 'Spy Game Backend is running', version: '1.0.0' });
    }
  });
});

// Initialize socket handlers
initSockets(io);

// Start server
async function start() {
  try {
    await redis.connect();
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Redis URL: ${config.redisUrl}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    redis.disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    redis.disconnect();
    process.exit(0);
  });
});

start();

module.exports = { app, server, io };
