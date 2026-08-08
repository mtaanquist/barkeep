# syntax=docker/dockerfile:1

# One image that serves the whole app on a single port.

# ---- Build the web pages --------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Install server packages ----------------------------------------------
# Debian, because two packages ship ready-built for it. The compiler is here
# as a fallback for platforms without a ready-built version.
FROM node:22-slim AS backend-deps
WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Build the server ------------------------------------------------------
FROM node:22-slim AS backend-build
WORKDIR /build

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/scripts ./scripts
COPY backend/src ./src
COPY shared ../shared
RUN npm run build

# ---- Runtime --------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/bar.db \
    UPLOADS_DIR=/app/uploads \
    FRONTEND_DIR=/app/public

COPY --from=backend-deps /build/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY --from=backend-build /build/dist ./dist
COPY --from=frontend /build/dist ./public

# Where the database and photos live.
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

# Tells Docker whether the bar is actually working, not just running.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)throw 0;process.exit(0)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/server.js"]
