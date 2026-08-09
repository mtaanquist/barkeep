# Working on the home bar

A small self-hosted bar. Guests browse a menu and order drinks; the bartender
works the queue. Orders update live.

It is used by guests and hosts at a party, not by developers. That shapes most
of the rules below.

## Writing style

**Comments: short, plain, and about *why*.** One line beats a paragraph. Put
longer reasoning in the commit message or pull request, where it isn't in the
way of the code.

Avoid jargon in comments and in anything a person using the app will read. Say
"only this machine" rather than "loopback", "safe to run again" rather than
"idempotent". Assume the reader is not a programmer.

Every visible string needs both English and Danish — see
`frontend/src/utils/translations.ts`. Flag Danish wording for review rather than
guessing at it.

## Shape of the thing

One container serves everything on one port: the API at `/api`, live updates at
`/api/events`, drink photos at `/uploads`, and the web pages. There is no
separate web server and no proxy between the parts.

Live updates go one way, server to browser, over a long-lived request. The
browser reconnects on its own when it drops, which is the main reason for doing
it this way — the previous two-way setup had to hand-roll that, and gave up
after three tries.

That is deliberate. The previous split-container setup kept drifting out of sync
with the code, and three separate bugs came from it. Keep it on one origin.

The database is SQLite, which is the right fit here and not something to
outgrow. Photos are files on disk. Both live in mounted folders (`data/`,
`uploads/`) that must survive an upgrade.

## Database changes

Add a dated `.sql` file to `backend/src/db/migrations/`. It is applied once on
the next start and recorded by filename, oldest first.

Never edit a migration that has already run — the change would be silently
skipped on any database that has seen it. Add a new one instead. A fingerprint
of each file is kept, so the app now refuses to start rather than run on with
the two out of step. Comments and whitespace count as edits.

A migration that mixes creating a table with adding a column should say
`IF NOT EXISTS` on the create. Anything already applied by hand is caught up a
statement at a time, and only statements that are harmless to run twice can be
handled that way.

Real installs have data in them. Anything that changes the schema should be
tried against a copy of a real database first, not just an empty one.

## Branches and releases

`staging` is where work lands. Open a pull request into it, one per issue, and
keep them small enough to read in one sitting.

`main` is what the bar runs. When `staging` is ready, squash-merge it into
`main`, which publishes the `latest` image. `staging` is then deleted and branched
fresh from `main` next time — so merge or retarget any open pull requests before
cutting a release, because deleting a branch closes anything aimed at it.

Images: `latest` from `main`, `staging` from `staging`, `sha-…` for pinning.
Test the `staging` image against a copy of the real data before releasing.

## Local checks

```sh
cd backend  && npm test && npm run lint && npm run typecheck
cd frontend && npx eslint src && npm run build
```

`docker compose -f compose.yaml -f compose.dev.yaml up --build` builds and runs
the real image from a checkout.

For a change that touches startup, the database, or file handling, run the image
against a copy of real data and confirm the container reports healthy — not just
that it starts. Tests do not cover the container itself.

## Types

The server is TypeScript, built with `npm run build` and run from `dist/`.
`npm run dev` runs the sources directly.

The shapes the API sends live in `shared/types.d.ts` and are imported by both
halves, so changing one without the other is a build error. It holds types only
and disappears when built, which is why neither half has to bundle it. Both
Dockerfile build stages need `COPY shared ../shared` for that to resolve.

The pages get them through `frontend/src/types.ts`, which is also where a couple
are re-named to suit the pages. Nothing in `frontend/src` should write out an
API shape by hand — that is how the two sides drifted apart before.

SQLite has no boolean, so flags arrive as `0` or `1`. Type them as `Flag` and
compare with `=== 1`; do not pretend they are booleans.

Routes share a few pieces rather than repeating them: `route()` turns a thrown
error into the right reply, `HttpError` carries the status, `findBar`/`findDrink`
and friends do the lookups, and `buildUpdate` assembles a partial update. A new
route should not need a try/catch.

Values that reach SQL must be passed as parameters, never built into the query
text.

## Tests

`createApp()` takes the database and folders it should use, so a test hands in
its own and nothing touches real data. `tests/helpers.js` has the pieces:
`makeTestApp()` for a wired-up app, `makeEmptyDatabase()` for testing the
migration steps, `seedBar()` for something to order.

Live updates are checked by putting a stand-in on `app.locals.wss` and looking
at what got sent, rather than opening a real connection.

Cover the behaviour, not the wiring. The tests worth having are the ones for
things that have actually gone wrong before: migrations against half-updated
databases, handler order, and anything touching files on disk.

## Don't commit

`.inspect/` holds copies of real data for debugging. It is ignored by git and by
the image build, and must stay that way: it contains guests' names and password
hashes.
