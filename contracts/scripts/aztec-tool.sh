#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CONTRACTS_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
DEFAULT_AZTEC_VERSION="4.2.0-aztecnr-rc.2"
VERSION_FILE="$CONTRACTS_DIR/.aztecrc"
ORIGINAL_HOME="${HOME:-}"
TMP_BASE="${TMPDIR:-/tmp}"
DEFAULT_TOOL_HOME="${TMP_BASE%/}/aztec-treasure-hunt-tool-home"
DEFAULT_XDG_CACHE_HOME="${TMP_BASE%/}/aztec-treasure-hunt-xdg-cache"
LOCAL_NETWORK_RUN_DIR="${LOCAL_NETWORK_RUN_DIR:-${TMP_BASE%/}/aztec-treasure-hunt-local-network}"
AZTEC_NODE_PORT="${AZTEC_NODE_PORT:-8080}"
DEFAULT_ANVIL_PORT="${ANVIL_PORT:-8545}"
ANVIL_PID_FILE="$LOCAL_NETWORK_RUN_DIR/anvil.pid"
AZTEC_PID_FILE="$LOCAL_NETWORK_RUN_DIR/aztec-node.pid"

AZTEC_VERSION="$DEFAULT_AZTEC_VERSION"
if [ -f "$VERSION_FILE" ]; then
  AZTEC_VERSION=$(sed -n '1p' "$VERSION_FILE")
fi

AZTEC_HOME_DIR="${AZTEC_HOME_DIR:-$ORIGINAL_HOME/.aztec}"
AZTEC_ROOT="$AZTEC_HOME_DIR/versions/$AZTEC_VERSION"
AZTEC_BIN="$AZTEC_ROOT/node_modules/@aztec/aztec/dest/bin/index.js"
AZTEC_COMPILE_SH="$AZTEC_ROOT/node_modules/@aztec/aztec/scripts/compile.sh"

if [ ! -f "$AZTEC_BIN" ]; then
  echo "Aztec $AZTEC_VERSION is not installed." >&2
  echo "Run: PATH=\"$HOME/.aztec/bin:\$PATH\" $HOME/.aztec/bin/aztec-up install $AZTEC_VERSION" >&2
  exit 1
fi

export PATH="$AZTEC_ROOT/node_modules/.bin:$AZTEC_ROOT/bin:$PATH"

ensure_run_dir() {
  mkdir -p "$LOCAL_NETWORK_RUN_DIR"
}

cleanup_pid_file() {
  file=$1
  if [ -f "$file" ]; then
    rm -f "$file"
  fi
  return 0
}

cleanup_run_dir() {
  rmdir "$LOCAL_NETWORK_RUN_DIR" 2>/dev/null || true
}

read_pid_file() {
  file=$1
  if [ -f "$file" ]; then
    sed -n '1p' "$file"
  fi
}

process_alive() {
  pid=$1
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

listener_pid() {
  port=$1
  lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sed -n '1p'
}

listener_command() {
  port=$1
  lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 { print $1 }'
}

clear_stale_pid_file() {
  file=$1
  pid=$(read_pid_file "$file")
  if [ -n "$pid" ] && ! process_alive "$pid"; then
    cleanup_pid_file "$file"
  fi
  return 0
}

wait_for_port() {
  port=$1
  label=$2
  i=0
  while ! nc -z 127.0.0.1 "$port" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 150 ]; then
      echo "Timed out waiting for $label on port $port" >&2
      exit 1
    fi
    sleep 0.2
  done
}

STOPPED_ANY=0

kill_and_wait() {
  pid=$1
  label=$2

  if ! process_alive "$pid"; then
    return 0
  fi

  STOPPED_ANY=1
  echo "Stopping $label (pid $pid)..."
  kill "$pid" 2>/dev/null || true

  i=0
  while process_alive "$pid"; do
    i=$((i + 1))
    if [ "$i" -gt 50 ]; then
      echo "Force killing $label (pid $pid)..."
      kill -9 "$pid" 2>/dev/null || true
      break
    fi
    sleep 0.1
  done
  return 0
}

stop_from_pid_file() {
  file=$1
  label=$2
  pid=$(read_pid_file "$file")

  if [ -n "$pid" ]; then
    kill_and_wait "$pid" "$label"
    cleanup_pid_file "$file"
  fi
  return 0
}

stop_listener_port() {
  port=$1
  label=$2
  pid=$(listener_pid "$port")

  if [ -n "$pid" ]; then
    cmd=$(listener_command "$port")
    if [ -n "$cmd" ]; then
      echo "Found $label on port $port via $cmd."
    else
      echo "Found $label on port $port."
    fi
    kill_and_wait "$pid" "$label"
  fi
  return 0
}

report_port_conflict() {
  port=$1
  label=$2
  pid=$(listener_pid "$port")
  cmd=$(listener_command "$port")

  echo "$label appears to already be running on port $port." >&2
  if [ -n "$cmd" ] || [ -n "$pid" ]; then
    echo "Listener: ${cmd:-unknown}${pid:+ (pid $pid)}" >&2
  fi
  echo "Use 'yarn aztec:stop' to stop the local network and try again." >&2
  exit 1
}

CMD=${1:-}
if [ -z "$CMD" ]; then
  echo "Usage: $0 <aztec-command> [args...]" >&2
  exit 1
fi
shift

case "$CMD" in
  compile)
    export HOME="${TOOL_HOME:-$DEFAULT_TOOL_HOME}"
    export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$DEFAULT_XDG_CACHE_HOME}"
    mkdir -p "$HOME" "$XDG_CACHE_HOME"
    exec /bin/bash "$AZTEC_COMPILE_SH" "$@"
    ;;
  test)
    export HOME="${TOOL_HOME:-$DEFAULT_TOOL_HOME}"
    export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$DEFAULT_XDG_CACHE_HOME}"
    mkdir -p "$HOME" "$XDG_CACHE_HOME"
    export LOG_LEVEL="${LOG_LEVEL:-error}"
    node "$AZTEC_BIN" start --txe --port 8081 &
    SERVER_PID=$!
    trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

    i=0
    while ! nc -z 127.0.0.1 8081 >/dev/null 2>&1; do
      i=$((i + 1))
      if [ "$i" -gt 150 ]; then
        echo "Timed out waiting for TXE on port 8081" >&2
        exit 1
      fi
      sleep 0.2
    done

    export NARGO_FOREIGN_CALL_TIMEOUT=300000
    exec nargo test --silence-warnings --oracle-resolver http://127.0.0.1:8081 --test-threads 16 "$@"
    ;;
  stop)
    if [ $# -gt 0 ] && [ "${1:-}" != "--local-network" ]; then
      echo "Usage: $0 stop [--local-network]" >&2
      exit 1
    fi

    clear_stale_pid_file "$AZTEC_PID_FILE"
    clear_stale_pid_file "$ANVIL_PID_FILE"

    stop_from_pid_file "$AZTEC_PID_FILE" "Aztec node"
    stop_from_pid_file "$ANVIL_PID_FILE" "Anvil"

    stop_listener_port "$AZTEC_NODE_PORT" "Aztec node"
    stop_listener_port "$DEFAULT_ANVIL_PORT" "Anvil"

    cleanup_pid_file "$AZTEC_PID_FILE"
    cleanup_pid_file "$ANVIL_PID_FILE"
    cleanup_run_dir

    if [ "$STOPPED_ANY" -eq 0 ]; then
      echo "No local network processes found."
    fi
    exit 0
    ;;
  start)
    if [ "${1:-}" = "--local-network" ]; then
      export ARCHIVER_POLLING_INTERVAL_MS="${ARCHIVER_POLLING_INTERVAL_MS:-500}"
      export P2P_BLOCK_CHECK_INTERVAL_MS="${P2P_BLOCK_CHECK_INTERVAL_MS:-500}"
      export SEQ_TX_POLLING_INTERVAL_MS="${SEQ_TX_POLLING_INTERVAL_MS:-500}"
      export WS_BLOCK_CHECK_INTERVAL_MS="${WS_BLOCK_CHECK_INTERVAL_MS:-500}"
      export ARCHIVER_VIEM_POLLING_INTERVAL_MS="${ARCHIVER_VIEM_POLLING_INTERVAL_MS:-500}"
      export TEST_ACCOUNTS="${TEST_ACCOUNTS:-true}"
      export LOG_LEVEL="${LOG_LEVEL:-info;silent:sequencer;verbose:debug_log}"
      export DEPLOY_AZTEC_CONTRACTS_SALT="${DEPLOY_AZTEC_CONTRACTS_SALT:-$(date +%s)}"

      clear_stale_pid_file "$AZTEC_PID_FILE"
      clear_stale_pid_file "$ANVIL_PID_FILE"

      if [ -n "$(listener_pid "$AZTEC_NODE_PORT")" ]; then
        report_port_conflict "$AZTEC_NODE_PORT" "Aztec node"
      fi

      if [ -n "$(listener_pid "$DEFAULT_ANVIL_PORT")" ]; then
        report_port_conflict "$DEFAULT_ANVIL_PORT" "Anvil"
      fi

      ensure_run_dir

      ANVIL_PORT="$DEFAULT_ANVIL_PORT"
      export L1_CHAIN_ID="${L1_CHAIN_ID:-31337}"
      export ETHEREUM_HOSTS="${ETHEREUM_HOSTS:-http://127.0.0.1:${ANVIL_PORT}}"

      anvil --version >/dev/null
      anvil --silent &
      ANVIL_PID=$!
      echo "$ANVIL_PID" > "$ANVIL_PID_FILE"
      wait_for_port "$ANVIL_PORT" "Anvil"

      cleanup_local_network() {
        status=$?
        trap - EXIT INT TERM
        cleanup_pid_file "$AZTEC_PID_FILE"
        cleanup_pid_file "$ANVIL_PID_FILE"
        if [ "${AZTEC_PID:-}" ] && process_alive "$AZTEC_PID"; then
          kill "$AZTEC_PID" 2>/dev/null || true
        fi
        if [ "${ANVIL_PID:-}" ] && process_alive "$ANVIL_PID"; then
          kill "$ANVIL_PID" 2>/dev/null || true
        fi
        cleanup_run_dir
        exit "$status"
      }

      trap cleanup_local_network EXIT INT TERM

      node "$AZTEC_BIN" start "$@" &
      AZTEC_PID=$!
      echo "$AZTEC_PID" > "$AZTEC_PID_FILE"
      wait "$AZTEC_PID"
      exit $?
    fi

    node "$AZTEC_BIN" start "$@"
    ;;
  *)
    exec node "$AZTEC_BIN" "$CMD" "$@"
    ;;
esac
