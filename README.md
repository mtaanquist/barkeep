# Barkeep

Drinks on tap for your guests. Barkeep puts your bar's menu on everyone's
phone, takes their orders, and keeps you on top of what to make next.

You run it yourself, on a machine at home. It is built for a party among
friends, not for a shop: there are no accounts and nothing to pay. A guest
scans a code, types their name, picks a drink, and waits.

## How an evening goes

You set up a bar and add the drinks you are pouring, each with a photo and a
recipe. You print or show the QR code.

Guests scan it, give a name, and get the menu. They pick something. It lands in
your queue.

You accept it, make it, and mark it ready. Their phone keeps up as you go, so
nobody has to ask whether their drink is coming. When you run out of something,
you mark it out of stock and it stops being offered.

## What guests get

- A menu on their phone, grouped by category or by base spirit
- Only what is actually available; anything out of stock is not offered
- Favourites, which move to the top of their menu
- One drink at a time, tracked from ordered to being made to ready
- The ability to cancel, up until you hand it over
- A "surprise me" button that picks something at random, with a try again
- A list of what they have had, and a way to order the same thing again
- The recipe, on the drinks you choose to share it for

## What you get

- A queue of orders to accept, mark ready, and mark done, oldest first
- The option to accept everything automatically when the bar gets busy
- Drinks with a photo, a recipe, a base spirit, and a short description for
  guests
- A cropping tool, so a photo sits nicely on the card
- A choice, per drink, of whether guests see the recipe or only the description
- Out of stock as a toggle, so you do not have to delete anything
- Categories, for grouping the menu how you like
- A QR code to show or print
- Simple figures: orders in total and today, the most popular drinks, and when
  the rush was

## Both

- English and Danish, though some of the host's own screens are still English
  only
- Everything updates on its own as orders come and go, with nothing to refresh
- If a phone loses signal it reconnects by itself, and only says something is
  wrong if it stays that way

## Running it

Barkeep is one container. The menu, the API, the live updates and the drink
photos are all served on a single port.

```yaml
services:
  barkeep:
    image: ghcr.io/mtaanquist/barkeep:latest
    container_name: barkeep
    restart: unless-stopped
    init: true
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    environment:
      # Switches on the operator panel (see below). Leave it out and the panel
      # stays off; everything else runs without any settings at all.
      OPERATOR_PASSWORD: choose-a-long-one
```

[`compose.yaml`](compose.yaml) is the same with a healthcheck and the optional
settings filled in.

```sh
docker compose up -d
```

The port is bound to `127.0.0.1`, so only the machine itself can reach Barkeep.
That is on purpose: put a reverse proxy in front to open it up, as below.

Change the first number if something on the machine already uses 3000, and
point the proxy at whatever you chose. The second number is inside the
container and is better left alone.

Two folders need to survive an upgrade:

| Folder     | Holds                         |
| ---------- | ----------------------------- |
| `data/`    | the database, one SQLite file |
| `uploads/` | drink photos                  |

Back both up together. The database refers to photos by filename, so they only
make sense as a pair.

### Setting up your bar

Open the address in a browser and create a bar. You pick two passwords: one for
yourself, and one you give to guests. Those are the only thing between the two
views, which is about the right amount of security for a party in a garden.

The QR code is in the settings. Show it on a screen, or print it and leave it
on the bar.

### The operator panel

One screen above all the bars, for whoever runs the server: it lists every bar,
when each was last used, and lets you retire a dead one. Switch it on by setting
`OPERATOR_PASSWORD`; leave it unset and the panel does not exist.

There is no link to it. Open the front page and tap the word **Barkeep**, top
left, seven times — a sign-in appears. The password is the one you set, checked
on the server; the hidden tap only keeps the door out of sight.

Retiring a bar can be undone: it disappears for guests and bartenders straight
away but can be restored, and is removed for good after
`SOFT_DELETE_RETENTION_DAYS` (60 days by default).

### Image tags

| Tag              | Built from                                     |
| ---------------- | ---------------------------------------------- |
| `latest`         | the released version, and what to normally run |
| `staging`        | the working branch, to try a change out first  |
| `v1.2.3`, `v1.2` | a specific release                             |
| `sha-abc1234`    | a single build, to pin to an exact commit      |

Images are built for Intel and ARM, so a Raspberry Pi works as well as a NUC.

### Settings

All optional. The defaults suit one container behind a proxy on the same
machine.

| Variable      | Default                            | What it does                                                                                                      |
| ------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `PORT`        | `3000`                             | Port inside the container.                                                                                          |
| `DB_PATH`     | `/app/data/bar.db`                 | Where the database file lives.                                                                                      |
| `UPLOADS_DIR` | `/app/uploads`                     | Where drink photos live.                                                                                            |
| `PUBLIC_URL`  | taken from the request             | The address to put in QR codes. Needed only if guests reach Barkeep on a different address than the one it sees.     |
| `PUID`/`PGID` | unset, runs as root                | Run as an ordinary user instead. Ownership of the two folders is fixed on start.                                    |
| `TRUST_PROXY` | this machine and the local network | Which proxies may say what address a guest used. Widening this would let an outsider point your QR codes elsewhere. |
| `TZ`          | `UTC`                              | Which clock "today" is measured against, which decides what counts as today's orders.                               |
| `OPERATOR_PASSWORD` | unset, panel off             | The password for the operator panel, which lists every bar and can retire a dead one. Leave it unset and the panel stays switched off. |
| `SOFT_DELETE_RETENTION_DAYS` | `60`                | How many days a retired bar stays recoverable before it is removed for good.                                        |

### Putting a proxy in front

If the proxy runs on the same machine, point it at the published port:

```caddyfile
bar.example.com {
	reverse_proxy localhost:3000
}
```

Caddy needs nothing else. It passes the live updates straight through.

If the proxy runs in its own container, share a network with it instead of
publishing a port at all. Create the network once, outside either stack:

```sh
docker network create edge
```

Then drop the `ports:` block from `compose.yaml` and add:

```yaml
services:
  barkeep:
    networks: [edge]

networks:
  edge:
    external: true
```

The proxy joins the same network and points at `barkeep:3000`. Barkeep is then
not reachable from outside Docker at all.

### Checking it is up

The container reports its own health, so `docker ps` and Dockge show whether
Barkeep is actually answering rather than merely running. `/api/health` is the
same check if you want to watch it yourself.

### Upgrading

Pull the new image and start it. Any changes to the database are made on the
way up, inside the same container, so there is nothing to run by hand.

Each applied change is recorded with a fingerprint of the file that made it. If
one of those files is later altered, Barkeep stops and names it rather than
running on with the database and the code disagreeing.

Photos no drink refers to are cleared out at startup, but only once they are
more than a day old, so one uploaded while you are still filling in the form is
safe.

## Development

The two halves run separately while you work on them, with the menu proxying
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

Both halves are TypeScript. The shapes the API sends live in one file,
`shared/types.d.ts`, that both import, so changing one side without the other
is a build error. Both linters fail on a warning.

The tests for the pages run against a stand-in browser, so they need neither a
server nor a real one.

### Changing the database

Add a dated `.sql` file to `backend/src/db/migrations/`. It runs once, inside a
transaction, on the next start, oldest first. Never edit one that has already
run; add another instead.

[`CLAUDE.md`](CLAUDE.md) has the rest of the working notes.

## How it is built

```
Browser -> :3000 -> /api/*      the API
                    /api/events live updates, server to browser
                    /uploads/*  drink photos from disk
                    /*          the menu pages

                    SQLite, one file, in data/
```

One container on one address, which keeps the whole thing small enough to hold
in your head and leaves nothing to configure between the parts.

Live updates travel one way, from the server to the browser, over a long-lived
request. The browser handles reconnecting itself, which matters when a phone
sleeps in someone's pocket halfway through the evening.

SQLite suits this well. A party is a handful of people ordering drinks over an
evening, and one file is far easier to back up than a database server.
