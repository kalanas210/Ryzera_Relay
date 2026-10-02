#!/usr/bin/env sh
# Ship the committed HEAD to the server and rebuild there. Uncommitted work is never deployed.
#   infra/deploy.sh            # the "relay" host from ~/.ssh/config
#   infra/deploy.sh other-host
set -eu
HOST="${1:-relay}"
REV="$(git rev-parse --short HEAD)"

echo "Deploying $REV to $HOST"
git archive --format=tar HEAD | ssh "$HOST" "
  set -e
  rm -rf /opt/relay/src.new && mkdir -p /opt/relay/src.new
  tar -x -C /opt/relay/src.new
  echo $REV > /opt/relay/src.new/REVISION
  rm -rf /opt/relay/src && mv /opt/relay/src.new /opt/relay/src
"
ssh "$HOST" "sh /opt/relay/src/infra/server/up.sh"
