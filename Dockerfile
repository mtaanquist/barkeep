# syntax=docker/dockerfile:1

# Builds a single image that serves the API, the WebSocket endpoint, the
# uploaded images and the built frontend from one port.

# ---- Frontend build -------------------------------------------------------
# Pure JS toolchain, so alpine is fine and fast here.
FROM node:22-alpine AS frontend
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Backend dependencies -------------------------------------------------
# Debian rather than alpine: better-sqlite3 and bcrypt publish prebuilt glibc
# binaries, so this normally downloads rather than compiles. The toolchain is
# installed anyway so the build still succeeds on platforms without prebuilts.
FROM node:22-slim AS backend-deps
WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

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
COPY backend/src ./src
COPY --from=frontend /build/dist ./public

# Mount points for the persistent data. Declared so the paths exist and are
# writable even when nothing is mounted over them.
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

# No curl or wget in the slim image, so the check is made with Node itself.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)throw 0;process.exit(0)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "src/server.js"]
