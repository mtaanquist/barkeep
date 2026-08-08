#!/bin/sh
set -e

DATA_DIR="$(dirname "${DB_PATH:-/app/data/bar.db}")"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"

mkdir -p "$DATA_DIR" "$UPLOADS_DIR"

# The container runs as root by default, which matches how existing bind-mounted
# data directories were created. Set PUID/PGID to run as an unprivileged user
# instead; ownership of the data is adjusted to match so nothing breaks.
if [ "$(id -u)" = "0" ] && [ -n "${PUID}${PGID}" ]; then
    uid="${PUID:-1000}"
    gid="${PGID:-1000}"

    chown -R "$uid:$gid" "$DATA_DIR" "$UPLOADS_DIR"

    exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$@"
fi

exec "$@"
