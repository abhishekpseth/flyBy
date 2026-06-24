#!/usr/bin/env bash
# Leave "flight mode": stop the notifier server and quit MTMR (Touch Bar back to normal).
cd "$(dirname "$0")/.."

if pkill -f "node src/server.js" 2>/dev/null; then
  echo "✈  Server stopped."
else
  echo "✈  Server was not running."
fi

osascript -e 'quit app "MTMR"' 2>/dev/null || true
echo "✈  MTMR quit — Touch Bar is back to normal."
