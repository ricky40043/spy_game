#!/bin/sh
# Start Redis in background (pure memory mode, no persistence)
redis-server --save "" --appendonly no --daemonize yes --bind 127.0.0.1 --port 6379

# Wait for Redis to be ready
sleep 1

# Start Node.js backend in foreground (keeps container alive)
exec node backend/src/server.js
