#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.runtime"
LOG_DIR="$ROOT_DIR/logs"
API_PID_FILE="$RUN_DIR/api.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

mkdir -p "$RUN_DIR" "$LOG_DIR"

is_running() {
  local pid_file="$1"

  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

is_reachable() {
  local url="$1"

  curl -fsS "$url" >/dev/null 2>&1
}

listener_pid() {
  local port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    return 1
  fi

  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1
}

start_process() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  local port="$4"
  local health_url="$5"
  shift 5

  if is_running "$pid_file"; then
    echo "$name already running with PID $(cat "$pid_file")"
    return
  fi

  if is_reachable "$health_url"; then
    local existing_pid
    existing_pid="$(listener_pid "$port" || true)"

    if [[ -n "$existing_pid" ]]; then
      echo "$existing_pid" > "$pid_file"
      echo "$name already reachable at $health_url with PID $existing_pid"
    else
      echo "$name already reachable at $health_url"
    fi

    return
  fi

  rm -f "$pid_file"
  (
    cd "$ROOT_DIR"
    nohup "$@" > "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )

  echo "Started $name with PID $(cat "$pid_file")"
  echo "  log: $log_file"
}

wait_for_url() {
  local label="$1"
  local url="$2"

  for _ in {1..40}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label is reachable at $url"
      return 0
    fi

    sleep 0.25
  done

  echo "$label did not become reachable at $url"
  return 1
}

start_process "API" "$API_PID_FILE" "$LOG_DIR/api.log" "3000" "http://localhost:3000/api/lists" bun run dev:api
start_process "Frontend" "$FRONTEND_PID_FILE" "$LOG_DIR/frontend.log" "5173" "http://localhost:5173/" bun dev

wait_for_url "API" "http://localhost:3000/api/lists"
wait_for_url "Frontend" "http://localhost:5173/"

echo
echo "App running:"
echo "  Frontend: http://localhost:5173/"
echo "  API:      http://localhost:3000/api/lists"
