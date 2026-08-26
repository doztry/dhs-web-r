# DHS OpenCode Models Plugin

This folder contains an API-like DHS provider bridge for an OpenCode server. It translates OpenAI-compatible requests into OpenCode’s native session and message API, so DHS or another OpenAI-compatible client can call:

```text
GET  /v1/models
POST /v1/chat/completions
GET  /health
```

The bridge is intentionally separate from the remote web plugin. It uses OpenCode for model execution and keeps the OpenCode credential on the server side.

## Run

Start OpenCode separately, for example on its default local server:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Then start the bridge:

```bash
export OPENCODE_BASE_URL=http://127.0.0.1:4096
export DHS_OPENCODE_API_KEY='use-a-random-16-character-or-longer-key'
node src/server.mjs
```

The bridge binds to `127.0.0.1` by default. For a remote deployment, put TLS and authentication in front of it and explicitly set both `DHS_OPENCODE_ALLOW_REMOTE=1` and a non-loopback host. The bridge rejects remote binding otherwise.

Example client request:

```bash
curl http://127.0.0.1:8090/v1/chat/completions \\
  -H "Authorization: Bearer $DHS_OPENCODE_API_KEY" \\
  -H 'content-type: application/json' \\
  -d '{"model":"opencode/your-model-id","messages":[{"role":"user","content":"Say hello."}],"stream":false}'
```

## Compatibility

The first version supports non-streaming text chat and model listing. It rejects streaming and tool calls explicitly rather than silently dropping them. The next extension should map OpenCode event streams into DHS `StreamChunk` values and translate tool schemas into OpenCode permissions before enabling those features.

## Security

The bridge requires a bearer key of at least 16 characters for every API route except `/health`. It uses constant-time comparison, limits request bodies to 1 MiB, does not accept a request-supplied upstream URL or upstream credential, does not log prompts or responses, and returns sanitized upstream errors. The OpenCode endpoint is configured by the operator through `OPENCODE_BASE_URL`; it is never taken from a client request.

OpenCode’s own server can also use `OPENCODE_SERVER_PASSWORD` for Basic authentication. Keep both the OpenCode credential and the bridge credential outside Git and inject them through the process environment or a secret manager.
