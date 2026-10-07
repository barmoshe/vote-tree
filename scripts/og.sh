#!/bin/sh
# Renders public/og.png from the /og-card route of a running local server (npm run dev).
set -e
BASE="${1:-http://localhost:8793}"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --force-color-profile=srgb --force-prefers-color-scheme=light --virtual-time-budget=4000 \
  --window-size=1200,630 --screenshot="$(pwd)/public/og.png" "$BASE/og-card"
