#!/usr/bin/env bash
# Thin wrapper so `./scripts/dev-up.sh` works on macOS/Linux/Git Bash.
# The real cross-platform implementation lives in scripts/dev-up.mjs
# (invoked here, and also directly via `npm run dev:up`).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/dev-up.mjs" "$@"
