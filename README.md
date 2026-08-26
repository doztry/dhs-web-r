# DeepSeek Harness Web App R

`dhs-web-r` is our remote-service variant of the DeepSeek Harness web plugin. The `-r` suffix distinguishes this package from the upstream `@deepseek-ai/dsh-web-app` package.

This repository contains the renamed web-plugin package plus the minimal shared `client-connection` integration required for remote browsers to use the normal host-backed service boundary. It is intentionally not a route-by-route workaround: the web plugin declares one `remoteService` mode, and the shared connection layer consumes that mode for HTTP RPC, native WebSocket downlinks, settings, providers, credentials, filesystem actions, and preset configuration.

## Repository layout

| Path | Purpose |
|---|---|
| `packages/bundle/dhs-web-r` | Renamed remote web-plugin package and composition |
| `patches/upstream-remote-service.patch` | Core/web integration patch against the upstream harness checkout |
| `patches/activity-log.ts` | Shared metadata-only transport logger source |
| `scripts/start-shared-remote.sh` | Remote-service launcher with process cleanup and optional Cloudflare tunnel |

## Apply to an upstream checkout

Apply `patches/upstream-remote-service.patch` at the root of a compatible DeepSeek Harness checkout. Then use the renamed package directory as the remote web-profile variant, or keep the upstream package name and use the included remote composition changes.

## Run

```bash
export DSH_TRUSTED_HOST=your.public.host
export DSH_PUBLIC_URL=https://your.public.host
export DSH_REMOTE_SERVICE=1
./scripts/start-shared-remote.sh
```

`trustedHosts` is a DNS-rebinding/reachability control, not authentication. Put TLS and an authentication layer in front of any internet-facing deployment.

