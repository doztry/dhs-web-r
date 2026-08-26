#!/usr/bin/env bash
set -Eeuo pipefail

# Unified shared-remote launcher for DeepSeek Harness.
# This launcher deliberately requires an explicit acknowledgement before
# exposing a service without an external authentication layer.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${DSH_PORT:=3085}"
: "${DSH_HOST:=127.0.0.1}"
: "${DSH_CLOUDFLARE:=0}"
: "${DSH_ACTIVITY_LOG:="${ROOT_DIR}/dsh-activity.ndjson"}"

if [[ -z "${DSH_TRUSTED_HOST:-}" ]]; then
  echo "start-shared-remote: DSH_TRUSTED_HOST is required" >&2
  exit 2
fi

if [[ "${DSH_HOST}" != "0.0.0.0" && "${DSH_HOST}" != "127.0.0.1" ]]; then
  echo "start-shared-remote: DSH_HOST must be 0.0.0.0 or 127.0.0.1" >&2
  exit 2
fi

if [[ ! "${DSH_PORT}" =~ ^[0-9]+$ ]] || (( DSH_PORT > 65535 )); then
  echo "start-shared-remote: DSH_PORT must be an integer from 0 to 65535" >&2
  exit 2
fi

# The core accepts only a bare canonical authority in --trusted-host.
if [[ "${DSH_TRUSTED_HOST}" == *://* || "${DSH_TRUSTED_HOST}" == */* || "${DSH_TRUSTED_HOST}" == *[[:space:]]* ]]; then
  echo "start-shared-remote: DSH_TRUSTED_HOST must be a bare host[:port] authority" >&2
  exit 2
fi

if [[ -z "${DSH_PUBLIC_URL:-}" ]]; then
  DSH_PUBLIC_URL="https://${DSH_TRUSTED_HOST}"
  if [[ "${DSH_TRUSTED_HOST}" != *:* ]]; then
    DSH_PUBLIC_URL="${DSH_PUBLIC_URL}"
  fi
fi

if [[ "${DSH_HOST}" == "0.0.0.0" && "${DSH_ALLOW_UNAUTHENTICATED_REMOTE:-0}" != "1" ]]; then
  cat >&2 <<'EOF'
start-shared-remote: refusing to expose 0.0.0.0 without authentication.
Put TLS/authentication in front of the service and set
DSH_ALLOW_UNAUTHENTICATED_REMOTE=1 only when you explicitly accept the risk.
EOF
  exit 2
fi

if [[ "${DSH_CLOUDFLARE}" == "1" ]]; then
  cat >&2 <<'EOF'
start-shared-remote: DSH_CLOUDFLARE=1 is not supported by this launcher yet.
Quick Tunnels allocate a hostname after startup, so the trusted authority must
be provisioned first; use a named tunnel or set up the tunnel separately.
EOF
  exit 2
fi

umask 077
mkdir -p "$(dirname "${DSH_ACTIVITY_LOG}")"

child_pid=""
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  [[ -n "${child_pid}" ]] && kill "${child_pid}" 2>/dev/null || true
  wait "${child_pid}" 2>/dev/null || true
  exit "${status}"
}
trap cleanup EXIT INT TERM

export DSH_REMOTE_SERVICE=1
export DSH_ACTIVITY_LOG

cd "${ROOT_DIR}"
pnpm dsh web \
  --host "${DSH_HOST}" \
  --port "${DSH_PORT}" \
  --trusted-host "${DSH_TRUSTED_HOST}" \
  --public-url "${DSH_PUBLIC_URL}" \
  --no-open &
child_pid=$!
wait "${child_pid}"
child_pid=""
