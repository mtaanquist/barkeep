# Home Bar System

A small self-hosted bar: guests browse the menu and order drinks, the bartender
works the queue, and orders update live over WebSockets.

## Running it

The application ships as a single image on GHCR. Everything — the API, the
WebSocket endpoint, uploaded images and the frontend — is served from one port.

```yaml
services:
  home-bar:
    image: ghcr.io/mtaanquist/home-bar-system:latest
    restart: unless-stopped
    ports:
      - "21000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
```

A complete file with the healthcheck included is in [`compose.yaml`](compose.yaml):

```sh
docker compose up -d
```

Then open <http://localhost:21000>.

### Image tags

| Tag | Built from |
| --- | --- |
| `latest` | `main` — what the bar should normally run |
| `staging` | `staging` — the working branch, for trying a change on the real host first |
| `v1.2.3`, `v1.2` | release tags |
| `sha-abc1234` | any build, for pinning to an exact commit |

### Configuration

| Variable      | Default             | Purpose                                                                                                |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `PORT`        | `3000`              | Port inside the container.                                                                              |
| `DB_PATH`     | `/app/data/bar.db`  | SQLite database file.                                                                                   |
| `UPLOADS_DIR` | `/app/uploads`      | Uploaded drink images.                                                                                  |
| `PUBLIC_URL`  | derived from request | Base URL baked into guest QR codes. Only needed when guests reach the bar on a different address.       |
| `PUID`/`PGID` | unset (runs as root) | Run as an unprivileged user. Ownership of the data directories is adjusted on start.                    |
| `TZ`          | `UTC`               | Container timezone.                                                                                     |

The container reports health on `/api/health`, so `docker ps` and Dockge show a
real status rather than just "running".

### Upgrading from the two-container setup

The old layout ran three services: `frontend` (nginx), `backend`, and a one-shot
`db-init` container that exited as soon as it finished — which is why Dockge
reported the stack as exited. Migrations now run in-process on every boot, so
there is no container left behind in a dead state.

To move across, keep your `data/` and `uploads/` directories where they are and
replace the compose file. The database is picked up as-is: migrations are
tracked by filename in a `migrations` table, already-applied ones are skipped,
and a database that predates that table is detected and recorded rather than
re-applied.

Guests previously reached the frontend on port `21000`, and the new single
service uses the same host port, so existing bookmarks and QR codes keep
working. The old `21030` and `21080` mappings are gone — `21080` never had
anything listening on it.

## Development

The backend and frontend run separately in development, with Vite proxying
`/api` and `/uploads` to the backend.

```sh
cd backend  && npm install && npm run dev   # http://localhost:3000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

The backend creates `backend/data/bar.db` and `backend/uploads/` on first run
and applies migrations automatically.

To build and run the production image from a checkout:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

### Database migrations

Add a date-prefixed `.sql` file to `backend/src/db/migrations/`. It is applied
once, inside a transaction, on the next start and recorded by filename. Files
are applied in lexical order, so the date prefix determines ordering.

## Architecture

```
Browser ──▶ :3000 ──┬─▶ /api/*     Express routes
                    ├─▶ /ws        WebSocket (same HTTP server)
                    ├─▶ /uploads/* drink images from disk
                    └─▶ /*         built frontend, SPA fallback

                       SQLite (WAL) at DB_PATH
```

Serving everything from one origin is what lets the frontend use relative `/api`
and `/ws` paths with no proxy configuration and no CORS.
