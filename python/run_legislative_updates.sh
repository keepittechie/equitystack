#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

if [ -f "venv/bin/activate" ]; then
  . "venv/bin/activate"
fi

python3 update_database.py "$@"
