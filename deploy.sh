#!/bin/bash
set -e

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
  josh@10.10.0.13:/home/josh/black-policy-site/ "$BACKUP_DIR/"

echo "Deploying local code to server"

rsync -avzh --delete \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=.env \
  --exclude=research \
  --exclude=python/reports \
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
