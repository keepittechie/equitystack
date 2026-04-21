#!/bin/bash
set -e

REMOTE_HOST="josh@10.10.0.13"
REMOTE_APP_DIR="/opt/equitystack-frontend"
PM2_APP_NAME="equitystack-frontend"

UNTRACKED_DEPLOY_FILES=$(git ls-files --others --exclude-standard -- app lib docs python public bin package.json package-lock.json deploy.sh 2>/dev/null | grep -v '^python/reports/' || true)

if [ -n "$UNTRACKED_DEPLOY_FILES" ]; then
  echo "Refusing to deploy with untracked deployable files:"
  echo "$UNTRACKED_DEPLOY_FILES"
  echo
  echo "Add, ignore, or remove these files before running ./deploy.sh so production does not rely on local-only code."
  exit 1
fi

BACKUP_DIR="$HOME/Documents/GitHub/backups/equitystack_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Backing up current server code to: $BACKUP_DIR"

rsync -avzh \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=.env \
  --exclude=python/venv \
  "$REMOTE_HOST:$REMOTE_APP_DIR/" "$BACKUP_DIR/"

echo "Deploying local code to server"

rsync -avzh --delete \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=.env \
  --exclude=research \
  --exclude=python/reports \
  --exclude=python/venv \
  ./ "$REMOTE_HOST:$REMOTE_APP_DIR/"

echo "Building and restarting app"

ssh "$REMOTE_HOST" "bash -lc '
  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
  cd \"$REMOTE_APP_DIR\"
  npm run build
  if pm2 describe $PM2_APP_NAME >/dev/null 2>&1; then
    pm2 restart $PM2_APP_NAME
  else
    pm2 start npm --name $PM2_APP_NAME -- start
  fi
  pm2 status $PM2_APP_NAME
'"
