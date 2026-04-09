# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Install backend production dependencies
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 3: Final image
FROM node:20-alpine

# Install Redis
RUN apk add --no-cache redis

WORKDIR /app

# Copy backend source and production dependencies
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Copy frontend build to the path server.js expects: ../../frontend/dist from /app/backend/src
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["./start.sh"]
