#!/usr/bin/env bash
set -euo pipefail

# Prepare the REMOTE machine where learn-anything skills/scripts run.
# This does not install Google auth or NotebookLM sidecar; those stay local.
# Remote only needs Node for validators/helpers and an endpoint env var pointing
# to the SSH reverse-forwarded local NotebookLM MCP HTTP server.

REMOTE_PORT="${REMOTE_PORT:-18000}"
ENDPOINT_ENV_NAME="${ENDPOINT_ENV_NAME:-NOTEBOOKLM_MCP_ENDPOINT}"
ENDPOINT_VALUE="${ENDPOINT_VALUE:-http://127.0.0.1:${REMOTE_PORT}}"
PROFILE_FILE="${PROFILE_FILE:-$HOME/.profile}"
INSTALL_NODE="${INSTALL_NODE:-auto}"

usage() {
  cat <<USAGE
Usage: bash learn-anything-plugin/scripts/notebooklm/setup-remote.sh [options]

Options:
  --remote-port PORT        Remote SSH reverse port, default: 18000
  --endpoint-env NAME       Env var name, default: NOTEBOOKLM_MCP_ENDPOINT
  --endpoint VALUE          Endpoint value, default: http://127.0.0.1:<remote-port>
  --profile-file PATH       Shell profile to update, default: ~/.profile
  --install-node MODE       auto|never, default: auto
  -h, --help                Show this help

Examples:
  bash learn-anything-plugin/scripts/notebooklm/setup-remote.sh
  bash learn-anything-plugin/scripts/notebooklm/setup-remote.sh --remote-port 18000

After this, keep the local sidecar and SSH reverse tunnel running:
  local> notebooklm-mcp --transport http --port 8000
  local> ssh -N -R 18000:127.0.0.1:8000 <remote-host>

Then remote scripts/skills can use:
  export NOTEBOOKLM_MCP_ENDPOINT=http://127.0.0.1:18000
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote-port) REMOTE_PORT="$2"; ENDPOINT_VALUE="http://127.0.0.1:$2"; shift 2 ;;
    --endpoint-env) ENDPOINT_ENV_NAME="$2"; shift 2 ;;
    --endpoint) ENDPOINT_VALUE="$2"; shift 2 ;;
    --profile-file) PROFILE_FILE="$2"; shift 2 ;;
    --install-node) INSTALL_NODE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

log() { printf '\n==> %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

install_node_with_best_effort() {
  if [[ "$INSTALL_NODE" == "never" ]]; then
    echo "Node install disabled (--install-node never)." >&2
    return 1
  fi

  if have node; then
    return 0
  fi

  log "Node.js not found; attempting best-effort install"
  if have apt-get; then
    sudo apt-get update
    sudo apt-get install -y nodejs npm
  elif have dnf; then
    sudo dnf install -y nodejs npm
  elif have yum; then
    sudo yum install -y nodejs npm
  elif have pacman; then
    sudo pacman -Sy --noconfirm nodejs npm
  elif have apk; then
    sudo apk add --no-cache nodejs npm
  elif have brew; then
    brew install node
  else
    echo "Could not find a supported package manager. Install Node.js 18+ manually." >&2
    return 1
  fi
}

log "Checking Node.js for repo-local NotebookLM helper scripts"
install_node_with_best_effort || true
if ! have node; then
  echo "ERROR: node is still unavailable. Install Node.js 18+ and rerun." >&2
  exit 1
fi
NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "ERROR: Node.js 18+ required; found $(node --version)." >&2
  exit 1
fi
echo "Node: $(node --version)"

log "Checking SSH client"
if have ssh; then
  echo "ssh: $(command -v ssh)"
else
  echo "WARNING: ssh client not found on remote. Usually only local needs to initiate the reverse tunnel." >&2
fi

log "Persisting NotebookLM MCP endpoint env var"
mkdir -p "$(dirname "$PROFILE_FILE")"
touch "$PROFILE_FILE"
EXPORT_LINE="export ${ENDPOINT_ENV_NAME}='${ENDPOINT_VALUE}'"
if grep -qE "^export ${ENDPOINT_ENV_NAME}=" "$PROFILE_FILE"; then
  tmp="$(mktemp)"
  sed -E "s|^export ${ENDPOINT_ENV_NAME}=.*|${EXPORT_LINE}|" "$PROFILE_FILE" > "$tmp"
  cat "$tmp" > "$PROFILE_FILE"
  rm -f "$tmp"
else
  {
    echo ""
    echo "# learn-anything NotebookLM MCP endpoint via SSH reverse tunnel"
    echo "$EXPORT_LINE"
  } >> "$PROFILE_FILE"
fi
export "${ENDPOINT_ENV_NAME}=${ENDPOINT_VALUE}"
echo "${ENDPOINT_ENV_NAME}=${ENDPOINT_VALUE}"
echo "Updated: $PROFILE_FILE"

log "Running repo-local validators when available"
if [[ -f learn-anything-plugin/scripts/notebooklm/validate-smoke-docs.mjs ]]; then
  node learn-anything-plugin/scripts/notebooklm/validate-smoke-docs.mjs
fi
if [[ -f learn-anything-plugin/scripts/notebooklm/validate-manifest.mjs && -f learn-anything-plugin/scripts/notebooklm/fixtures/valid-manifest.json ]]; then
  node learn-anything-plugin/scripts/notebooklm/validate-manifest.mjs learn-anything-plugin/scripts/notebooklm/fixtures/valid-manifest.json
fi
if compgen -G "learn-anything-plugin/scripts/notebooklm/*.test.mjs" >/dev/null; then
  node --test learn-anything-plugin/scripts/notebooklm/*.test.mjs
fi

log "Optional endpoint probe"
if have curl; then
  if curl --max-time 2 --silent --show-error "${ENDPOINT_VALUE}" >/dev/null; then
    echo "Endpoint responded at ${ENDPOINT_VALUE}"
  else
    echo "Endpoint did not respond yet. This is OK until local sidecar + SSH reverse tunnel are running." >&2
  fi
else
  echo "curl not found; skipping endpoint probe."
fi

cat <<DONE

Remote setup finished.

Use this on the local machine:
  notebooklm-mcp --transport http --port 8000
  ssh -N -R ${REMOTE_PORT}:127.0.0.1:8000 <remote-host>

Use this on the remote machine/session if the shell was already open:
  export ${ENDPOINT_ENV_NAME}='${ENDPOINT_VALUE}'

No NotebookLM cookies/tokens were installed on remote; auth remains local.
DONE
