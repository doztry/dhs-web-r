#!/usr/bin/env bash
set -Eeuo pipefail

# Unified shared-remote launcher for DeepSeek Harness.
# Required for a remotely reachable service:
#   DSH_TRUSTED_HOST=public.example
# Optional:
#   DSH_PORT=3085 DSH_HOST=0.0.0.0 DSH_PUBLIC_URL=https://public.example
#   DSH_CLOUDFLARE=1 DSH_ACTIVITY_LOG=/path/activity.ndjson

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${DSH_PORT:=3085}"
: "${DSH_HOST:=0.0.0.0}"
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

if [[ -z "${DSH_PUBLIC_URL:-}" ]]; then
  if [[ "${DSH_TRUSTED_HOST}" == http://* || "${DSH_TRUSTED_HOST}" == https://* ]]; then
    DSH_PUBLIC_URL="${DSH_TRUSTED_HOST}"
  else
    DSH_PUBLIC_URL="http://${DSH_TRUSTED_HOST}:${DSH_PORT}"
  fi
fi

mkdir -p "$(dirname "${DSH_ACTIVITY_LOG}")"

child_pid=""
tunnel_pid=""
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  [[ -n "${tunnel_pid}" ]] && kill "${tunnel_pid}" 2>/dev/null || true
  [[ -n "${child_pid}" ]] && kill "${child_pid}" 2>/dev/null || true
  wait "${tunnel_pid}" 2>/dev/null || true
  wait "${child_pid}" 2>/dev/null || true
  exit "${status}"
}
trap cleanup EXIT INT TERM

if [[ "${DSH_CLOUDFLARE}" == "1" ]]; then
  command -v cloudflared >/dev/null || { echo "start-shared-remote: cloudflared is required when DSH_CLOUDFLARE=1" >&2; exit 2; }
  cloudflared tunnel --url "http://${DSH_HOST}:${DSH_PORT}" --no-autoupdate &
  tunnel_pid=$!
fi

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
