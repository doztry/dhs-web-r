import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const key = 'test-key-0123456789'
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
const request = (port, route, options = {}) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port, path: route, method: options.method ?? 'GET', headers: options.headers ?? {} }, res => {
    let data = ''; res.setEncoding('utf8'); res.on('data', chunk => { data += chunk }); res.on('end', () => resolve({ status: res.statusCode, body: data }))
  }); req.on('error', reject); if (options.body) req.write(options.body); req.end()
})
const waitFor = child => new Promise((resolve, reject) => { child.stdout.on('data', data => { const match = data.toString().match(/127\.0\.0\.1:(\d+)/); if (match) resolve(Number(match[1])) }); child.once('error', reject); child.once('exit', code => code && reject(new Error(`bridge exited ${code}`))) })

test('requires bearer auth and translates a non-streaming chat request', async t => {
  const upstream = http.createServer((req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk }); req.on('end', () => {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/session' && req.method === 'POST') return res.end(JSON.stringify({ id: 'ses_test' }))
      if (req.url === '/session/ses_test/message' && req.method === 'POST') return res.end(JSON.stringify({ parts: [{ type: 'text', text: 'hello from opencode' }] }))
      res.statusCode = 404; res.end('{}')
    })
  })
  const upstreamPort = await listen(upstream); t.after(() => upstream.close())
  const bridge = spawn(process.execPath, ['src/server.mjs'], { cwd: root, env: { ...process.env, OPENCODE_BASE_URL: `http://127.0.0.1:${upstreamPort}`, DHS_OPENCODE_PORT: '0', DHS_OPENCODE_API_KEY: key } })
  t.after(() => bridge.kill('SIGTERM'))
  const portLine = await waitFor(bridge)
  const denied = await request(portLine, '/v1/models'); assert.equal(denied.status, 401)
  const body = JSON.stringify({ model: 'opencode/coder', messages: [{ role: 'user', content: 'hello' }], stream: false })
  const accepted = await request(portLine, '/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body })
  assert.equal(accepted.status, 200); assert.match(accepted.body, /hello from opencode/)
})

test('refuses a non-loopback bind without explicit remote acknowledgement', async () => {
  const child = spawn(process.execPath, ['src/server.mjs'], { cwd: root, env: { ...process.env, DHS_OPENCODE_HOST: '0.0.0.0', DHS_OPENCODE_API_KEY: key } })
  const result = await new Promise(resolve => { let stderr = ''; child.stderr.on('data', d => { stderr += d }); child.on('exit', code => resolve({ code, stderr })) })
  assert.notEqual(result.code, 0); assert.match(result.stderr, /refusing non-loopback bind/)
})
