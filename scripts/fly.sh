#!/usr/bin/env bash
# Enter "flight mode": start the notifier server (detached) and launch MTMR.
set -euo pipefail
cd "$(dirname "$0")/.."

LOG=/tmp/flightnotifier.log

if pgrep -f "node src/server.js" >/dev/null; then
  echo "✈  Server already running."
else
  nohup node src/server.js > "$LOG" 2>&1 &
  echo "✈  Server started (logs: $LOG)"
fi

open -a MTMR
echo "✈  MTMR launched — flight info will appear on the Touch Bar when a plane is overhead."
echo "    Stop anytime with:  npm run stop"
