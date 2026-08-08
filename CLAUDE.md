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

One container serves everything on one port: the API at `/api`, live updates,
drink photos at `/uploads`, and the web pages. There is no separate web server
and no proxy between the parts.

That is deliberate. The previous split-container setup kept drifting out of sync
with the code, and three separate bugs came from it. Keep it on one origin.

The database is SQLite, which is the right fit here and not something to
outgrow. Photos are files on disk. Both live in mounted folders (`data/`,
`uploads/`) that must survive an upgrade.

## Database changes

Add a dated `.sql` file to `backend/src/db/migrations/`. It is applied once on
the next start and recorded by filename, oldest first.

Never edit a migration that has already run — the change would be silently
skipped on any database that has seen it. Add a new one instead.

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

`docker compose -f compose.yaml -f compose.dev.yaml up --build` builds and runs
the real image from a checkout.

For a change that touches startup, the database, or file handling, run the image
against a copy of real data and confirm the container reports healthy — not just
that it starts.

## Don't commit

`.inspect/` holds copies of real data for debugging. It is ignored by git and by
the image build, and must stay that way: it contains guests' names and password
hashes.
