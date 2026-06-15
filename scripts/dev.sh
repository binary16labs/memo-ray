#!/usr/bin/env bash
# Memo-Ray dev launcher (POSIX)
#
# Boots the server (Express on :3030) and client (Vite on :5175) in parallel.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT}/agent-os-dashboard/server"
CLIENT_DIR="${ROOT}/agent-os-dashboard/client"

# Check and install dependencies
for DIR in "${SERVER_DIR}" "${CLIENT_DIR}"; do
    if [[ ! -d "${DIR}/node_modules" ]]; then
        echo "▸ npm install in ${DIR}"
        ( cd "${DIR}" && npm install )
    fi
done

echo "▸ Memo-Ray dev launcher"
echo "  server → http://localhost:3030"
echo "  client → http://localhost:5175"

# Server - Express on :3030
export PORT="${PORT:-3030}"
( cd "${SERVER_DIR}" && node index.js ) &
SERVER_PID=$!

# Client - Vite + React
( cd "${CLIENT_DIR}" && npm run dev ) &
CLIENT_PID=$!

echo "  server PID = ${SERVER_PID}"
echo "  client PID = ${CLIENT_PID}"

PIDS="${SERVER_PID} ${CLIENT_PID}"

trap 'kill ${PIDS} 2>/dev/null || true' EXIT INT TERM
wait -n ${PIDS}
