# Home Bar System

A small self-hosted bar for a party. Guests pick a drink from a menu on their
phone, the host works through the orders, and everyone's screen keeps itself up
to date.

It is meant for a garden bar among friends, not a shop. There are no accounts
and no payments. A guest types their name, picks a drink, and waits.

## What it does

### For guests

- Browse the menu on a phone, grouped by category or by base spirit
- See what is available right now; anything out of stock is not offered
- Mark drinks as favourites, which then appear at the top of the menu
- Order one drink at a time, and watch it move from ordered to being made to
  ready
- Cancel an order, as long as it has not been handed over
- "Surprise me" picks a drink at random, with a try-again button
- Look back at what they have had, and order the same again
- Read the recipe, if the host has chosen to share it for that drink

### For the host

- A queue of orders to accept, mark ready, and mark done, oldest first
- Optionally accept every order automatically, for when the bar is busy
- Add drinks with a photo, a recipe, a base spirit, and a short description
- Crop and reposition a photo so it sits nicely on the card
- Choose per drink whether guests can read the recipe or only the description
- Mark a drink as out of stock without deleting it
- Sort drinks into categories
- A QR code, to show or print, that takes a guest straight to the bar's menu
- Simple figures: total orders, orders today, most popular drinks, busiest
  hours

### Both

- English and Danish, though some of the host's own screens are still English
  only
- Screens update on their own as orders come and go, with no refreshing
- If the connection drops, the browser reconnects by itself. Guests are only
  told something is wrong if it stays down.

## Running it

Everything is one container: the menu pages, the API, the live updates, and the
drink photos are all served on a single port.

```yaml
services:
  home-bar:
    image: ghcr.io/mtaanquist/home-bar-system:latest
    container_name: home-bar
    restart: unless-stopped
    init: true
    ports:
      - "127.0.0.1:21000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
```

[`compose.yaml`](compose.yaml) is the same thing with a healthcheck and the
optional settings included.

```sh
docker compose up -d
```

The port is bound to `127.0.0.1`, so only the machine itself can reach the bar.
That is deliberate: put a reverse proxy in front to open it up. See
[Putting a proxy in front](#putting-a-proxy-in-front) below.

Two folders need to survive an upgrade:

| Folder     | Holds                                         |
| ---------- | --------------------------------------------- |
| `data/`    | the database, one SQLite file                 |
| `uploads/` | drink photos                                  |

Back both up together. The database refers to photos by filename.

### The first bar

Open the address in a browser and create a bar. You choose two passwords: one
for yourself, and one you give to guests. They are the only thing separating
the two views, which is on purpose for a party.

Print the QR code from the settings and guests can reach the menu by pointing a
camera at it.

### Image tags

| Tag                | Built from                                          |
| ------------------ | --------------------------------------------------- |
| `latest`           | `main`, which is what the bar should normally run    |
| `staging`          | the working branch, for trying a change out first    |
| `v1.2.3`, `v1.2`   | release tags                                         |
| `sha-abc1234`      | any single build, for pinning to an exact commit     |

Images are built for both Intel and ARM machines, so a Raspberry Pi works as
well as a NUC.

### Settings

All optional. The defaults suit a single container behind a proxy on the same
machine.

| Variable      | Default                | What it does                                                                        |
| ------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `PORT`        | `3000`                 | Port inside the container.                                                            |
| `DB_PATH`     | `/app/data/bar.db`     | Where the database file lives.                                                        |
| `UPLOADS_DIR` | `/app/uploads`         | Where drink photos live.                                                              |
| `PUBLIC_URL`  | taken from the request  | The web address to put in QR codes. Only needed if guests reach the bar on a different address than the one it sees. |
| `PUID`/`PGID` | unset, runs as root     | Run as an ordinary user instead. Ownership of the two folders is fixed on start.      |
| `TRUST_PROXY` | this machine and the local network | Which proxies may say what address a guest used. Widening this lets an outsider point QR codes elsewhere. |
| `TZ`          | `UTC`                  | Which clock "today" is measured against, which matters for the daily figures.         |

### Putting a proxy in front

If the proxy runs on the same machine, point it at the published port:

```caddyfile
bar.example.com {
	reverse_proxy localhost:21000
}
```

Caddy needs nothing else. It passes the live updates through as they are.

If the proxy runs in its own container, share a network with it instead of
publishing a port at all. Create the network once, outside either stack:

```sh
docker network create edge
```

Then drop the `ports:` block from `compose.yaml` and add:

```yaml
services:
  home-bar:
    networks: [edge]

networks:
  edge:
    external: true
```

The proxy joins the same network and points at `home-bar:3000`. The bar is then
not reachable from outside Docker at all.

### Knowing it is working

The container reports its own health, so `docker ps` and Dockge show whether
the bar is actually answering rather than merely running. `/api/health` is the
same check if you want to watch it yourself.

### Upgrading

Pull the new image and start it. The database is brought up to date on the way
up, in the same container, so there is nothing to run by hand and nothing left
sitting in a stopped state afterwards.

Changes to the database are recorded once they have been applied, along with a
fingerprint of the file that made them. If one of those files is later edited,
the bar refuses to start and says which one, rather than running on with the
database and the code disagreeing.

Photos that no drink refers to are cleared out on start, but only if they are
more than a day old, so a photo uploaded while someone is still filling in the
form is left alone.

## Development

The two halves run separately while developing, with the menu pages proxying
`/api` and `/uploads` through to the server.

```sh
cd backend  && npm install && npm run dev   # http://localhost:3000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

The server creates `backend/data/bar.db` and `backend/uploads/` on first run.

To build and run the real image from a checkout:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

### Checks

```sh
cd backend  && npm test && npm run lint && npm run typecheck
cd frontend && npm test && npm run lint && npm run typecheck && npm run build
```

Both halves are TypeScript, and the shapes the API sends live in one file
(`shared/types.d.ts`) that both import, so changing one side without the other
is a build error. Both linters fail on a warning.

The tests for the pages run against a stand-in browser, so they need neither a
server nor a real browser.

### Changing the database

Add a dated `.sql` file to `backend/src/db/migrations/`. It is applied once, in
a transaction, on the next start, oldest first. Never edit one that has already
run; add another instead.

`CLAUDE.md` has the rest of the working notes: how the pieces fit, what the
tests are for, and what not to commit.

## How it is put together

```
Browser -> :3000 -> /api/*      the API
                    /api/events live updates, server to browser
                    /uploads/*  drink photos from disk
                    /*          the menu pages

                    SQLite, one file, in data/
```

One container on one address. That is the whole shape of it, and it is
deliberate: an earlier split across separate containers and a proxy kept
drifting out of step with the code, and three separate bugs came from it.

Live updates go one way only, from the server to the browser, over a long-lived
request. The browser reconnects on its own when it drops, which is the main
reason for doing it this way. The two-way version it replaced had to hand-roll
reconnection and gave up after three tries, so a phone that slept for a minute
stopped receiving orders until someone refreshed it.

SQLite is a good fit here and not something this will outgrow. A party is a
handful of people ordering drinks over an evening.
