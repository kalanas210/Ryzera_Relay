#!/usr/bin/env sh
# A compressed pg_dump of the Relay database; keeps the newest 14.
set -eu
OUT=/opt/relay-backups
STAMP="$(date +%Y-%m-%d-%H%M)"
docker exec relay-db-1 pg_dump -U relay --clean --if-exists relay | gzip > "$OUT/relay-$STAMP.sql.gz"
ls -1t "$OUT"/relay-*.sql.gz | tail -n +15 | xargs -r rm --
echo "$(date -Is) backup relay-$STAMP.sql.gz"
