#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.runtime"
API_PID_FILE="$RUN_DIR/api.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

is_running_pid() {
  local pid="$1"

  kill -0 "$pid" 2>/dev/null
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

stop_tree() {
  local pid="$1"

  if command -v pgrep >/dev/null 2>&1; then
    while read -r child_pid; do
      [[ -n "$child_pid" ]] && stop_tree "$child_pid"
    done < <(pgrep -P "$pid" 2>/dev/null || true)
  fi

  kill "$pid" 2>/dev/null || true
}

stop_process() {
  local name="$1"
  local pid_file="$2"
  local port="$3"
  local health_url="$4"
  local pid=""

  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
  elif is_reachable "$health_url"; then
    pid="$(listener_pid "$port" || true)"
  fi

  if [[ -z "$pid" ]]; then
    echo "$name is not running"
    return
  fi

  if is_running_pid "$pid"; then
    stop_tree "$pid"
    echo "Stopped $name with PID $pid"
  else
    echo "$name PID $pid was not running"
  fi

  rm -f "$pid_file"
}

stop_process "Frontend" "$FRONTEND_PID_FILE" "5173" "http://localhost:5173/"
stop_process "API" "$API_PID_FILE" "3000" "http://localhost:3000/api/lists"

echo "App stopped"
