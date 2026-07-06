#!/bin/zsh
# Double-click me to start Bloom 🌼
cd "$(dirname "$0")"
if ! lsof -i :5190 >/dev/null 2>&1; then
  echo "Starting Bloom…"
  nohup node server.mjs > /tmp/bloom-server.log 2>&1 &
  sleep 1
else
  echo "Bloom is already running."
fi
open "http://localhost:5190"
echo "Bloom is growing at http://localhost:5190 — you can close this window. 🌱"
