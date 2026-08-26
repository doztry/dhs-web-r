import http from 'node:http'
import crypto from 'node:crypto'
import { OpenCodeClient, normalizeTextContent } from './opencode-client.mjs'

const host = process.env.DHS_OPENCODE_HOST ?? '127.0.0.1'
const port = Number(process.env.DHS_OPENCODE_PORT ?? 8090)
const bridgeKey = process.env.DHS_OPENCODE_API_KEY
const maxBody = 1_048_576

if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('DHS_OPENCODE_PORT must be 0..65535')
if (host !== '127.0.0.1' && host !== '::1' && process.env.DHS_OPENCODE_ALLOW_REMOTE !== '1') {
  throw new Error('refusing non-loopback bind; set DHS_OPENCODE_ALLOW_REMOTE=1 only behind TLS/authentication')
}
if (!bridgeKey || bridgeKey.length < 16) throw new Error('DHS_OPENCODE_API_KEY must be at least 16 characters')

const client = new OpenCodeClient()
const timingSafeEqual = (a, b) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
const authorized = req => {
  const value = req.headers.authorization
  return typeof value === 'string' && value.startsWith('Bearer ') && timingSafeEqual(value.slice(7), bridgeKey)
}
const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}
const readBody = req => new Promise((resolve, reject) => {
  let size = 0; const chunks = []
  req.on('data', chunk => { size += chunk.length; if (size > maxBody) { reject(new Error('body too large')); req.destroy() } else chunks.push(chunk) })
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch { reject(new Error('invalid JSON')) } })
  req.on('error', reject)
})
const text = messages => messages.map(message => `${message.role}: ${normalizeTextContent(message.content)}`).join('\n\n')

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (url.pathname === '/health' && req.method === 'GET') return json(res, 200, { ok: true })
  if (!authorized(req)) return json(res, 401, { error: { message: 'unauthorized', type: 'authentication_error' } })
  try {
    if (url.pathname === '/v1/models' && req.method === 'GET') {
      const catalog = await client.models(req.signal)
      const models = Object.entries(catalog?.providers ?? {}).flatMap(([provider, value]) => Object.keys(value?.models ?? {}).map(id => ({ id: `${provider}/${id}`, object: 'model', owned_by: 'opencode' })))
      return json(res, 200, { object: 'list', data: models })
    }
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      const body = await readBody(req)
      if (body.stream === true) return json(res, 400, { error: { message: 'streaming is not yet supported; use stream:false', type: 'invalid_request_error' } })
      if (!Array.isArray(body.messages) || body.messages.length === 0) return json(res, 400, { error: { message: 'messages must be a non-empty array', type: 'invalid_request_error' } })
      if (body.tools !== undefined) return json(res, 400, { error: { message: 'tools are not yet supported by this bridge', type: 'invalid_request_error' } })
      const model = typeof body.model === 'string' && body.model.length > 0 ? body.model : 'opencode/default'
      const [, modelID = model] = model.split(/\/(.*)/s)
      const session = await client.createSession('DHS OpenCode bridge')
      const result = await client.prompt(session.id, { model: { providerID: model.split('/')[0], modelID }, parts: [{ type: 'text', text: text(body.messages) }] })
      const output = (result?.parts ?? []).filter(part => part.type === 'text').map(part => part.text).join('')
      return json(res, 200, { id: `chatcmpl-${crypto.randomUUID()}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, message: { role: 'assistant', content: output }, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } })
    }
    return json(res, 404, { error: { message: 'not found', type: 'invalid_request_error' } })
  } catch (error) {
    // Deliberately do not forward upstream bodies, URLs, or credential details.
    return json(res, 502, { error: { message: error instanceof Error ? error.message : 'upstream failure', type: 'upstream_error' } })
  }
})

server.listen(port, host, () => {
  const address = server.address()
  const boundPort = typeof address === 'object' && address !== null ? address.port : port
  console.log(`dhs-opencode-models: listening on http://${host}:${boundPort}`)
})
