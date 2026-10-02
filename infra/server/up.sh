#!/usr/bin/env sh
# Runs on the server after each deploy: make the secrets once, rebuild, start, and keep nightly backups.
set -eu
ENV=/opt/relay/.env
cd /opt/relay/src

if [ ! -f "$ENV" ]; then
  umask 077
  cat > "$ENV" <<VARS
SITE_ADDRESS=relay-ryzera.tech, www.relay-ryzera.tech
RELAY_COOKIE_SECURE=true
RELAY_DEMO_MODE=true
RELAY_SEED_PASSWORD=relay2026
POSTGRES_USER=relay
POSTGRES_DB=relay
POSTGRES_PASSWORD=$(openssl rand -hex 24)
RELAY_SECRET_KEY=$(openssl rand -hex 48)
VARS
  echo "Wrote $ENV with new secrets"
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV" up -d --build --remove-orphans
docker image prune -f >/dev/null

# nightly database backup at 3:30 AM Sri Lanka time, the last 14 kept
sudo tee /etc/cron.d/relay-backup >/dev/null <<'CRON'
CRON_TZ=Asia/Colombo
30 3 * * * ubuntu sh /opt/relay/src/infra/server/backup.sh >> /opt/relay-backups/backup.log 2>&1
CRON

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV" ps --format "table {{.Service}}\t{{.Status}}"
echo "Live: $(cat REVISION)"
