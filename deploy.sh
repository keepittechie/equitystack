#!/bin/bash
set -e

BACKUP_DIR="$HOME/Documents/GitHub/backups/equitystack_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Backing up current server code to: $BACKUP_DIR"

rsync -avzh \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=.env \
  --exclude=python/venv \
  josh@10.10.0.13:/home/josh/black-policy-site/ "$BACKUP_DIR/"

echo "Deploying local code to server"

rsync -avzh --delete \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=.env \
  --exclude=python/venv \
  ./ josh@10.10.0.13:/home/josh/black-policy-site/

echo "Building and restarting app"

ssh josh@10.10.0.13 "bash -lc '
  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
  cd /home/josh/black-policy-site
  npm run build
  if pm2 describe nextjs-app >/dev/null 2>&1; then
    pm2 restart nextjs-app
  else
    pm2 start npm --name nextjs-app -- start
  fi
  pm2 status
'"
