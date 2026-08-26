# Security Review

## Scope

This review covers the remote web-plugin variant, the shared client-connection integration, and `scripts/start-shared-remote.sh`.

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| RWS-001 | Critical if internet-exposed | Shared remote mode exposes host-backed APIs, including filesystem, settings, credentials, providers, and preset configuration. The trust fence is not authentication. | Mitigated in launcher by defaulting to loopback and requiring `DSH_ALLOW_UNAUTHENTICATED_REMOTE=1` before `0.0.0.0` binding; production authentication remains required. |
| RWS-002 | High | A Quick Tunnel hostname is allocated after startup, so starting the tunnel and harness together cannot safely establish the correct trusted authority first. | Fixed by refusing `DSH_CLOUDFLARE=1` in the launcher until a named tunnel/provisioning flow is implemented. |
| RWS-003 | Medium | Activity logs could become sensitive if payloads or headers were recorded. | Mitigated: the logger records only timestamp, route, method, status, duration, and WebSocket acceptance; it records no payloads, credentials, or authorization headers. |
| RWS-004 | Dependency hygiene | The full upstream workspace audit reported 25 production dependency advisories, including high and moderate findings in transitive packages. This remote-plugin repository does not vendor or lock the complete upstream dependency graph. | Must be reviewed and remediated by the consuming upstream checkout before production deployment. |

## Trust model

`trustedHosts` is a DNS-rebinding and reachability control. It is not an identity check and does not prove that a caller is authorized to administer the host. A deployment serving a network other than a trusted private network must put TLS and authentication in front of the harness, preferably with an identity-aware reverse proxy or an equivalent authenticated gateway.

## Safe launch

The launcher defaults to `127.0.0.1`. To expose a service, configure a canonical bare authority and a public origin, place authentication in front of the service, and explicitly acknowledge the risk:

```bash
export DSH_TRUSTED_HOST=remote.example.com
export DSH_PUBLIC_URL=https://remote.example.com
export DSH_ALLOW_UNAUTHENTICATED_REMOTE=1
./scripts/start-shared-remote.sh
```

The acknowledgement variable is intentionally named to make an unauthenticated deployment conspicuous in process configuration and deployment review. It should not be used for an internet-facing service.

## Verification performed

The source workspace passed the focused remote-service suite with 83 tests across 10 files and completed the full build. The public test instance accepted the host, settings, and provider RPCs and opened both native WebSocket downlinks. Credentials calls still receive normal schema-level validation; transport authorization is no longer the source of the failure.
