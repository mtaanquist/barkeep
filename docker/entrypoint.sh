#!/bin/sh
set -e

DATA_DIR="$(dirname "${DB_PATH:-/app/data/bar.db}")"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"

mkdir -p "$DATA_DIR" "$UPLOADS_DIR"

# Runs as root unless PUID/PGID are set, which matches how existing data was
# created. When they are set, fix ownership first so nothing breaks.
if [ "$(id -u)" = "0" ] && [ -n "${PUID}${PGID}" ]; then
    uid="${PUID:-1000}"
    gid="${PGID:-1000}"

    chown -R "$uid:$gid" "$DATA_DIR" "$UPLOADS_DIR"

    exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$@"
fi

exec "$@"
