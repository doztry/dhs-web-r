import http from 'node:http'
const port = Number(process.env.MOCK_OPENCODE_PORT ?? 4096)
const json = (res, value) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
http.createServer((req, res) => {
  if (req.url === '/global/health') return json(res, { healthy: true, version: 'mock' })
  if (req.url === '/provider') return json(res, { all: [], default: {}, connected: [] })
  if (req.url === '/config/providers') return json(res, { providers: { opencode: { models: { coder: {} } } }, default: {} })
  let body = ''; req.on('data', chunk => { body += chunk }); req.on('end', () => {
    if (req.url === '/session' && req.method === 'POST') return json(res, { id: 'ses_mock' })
    if (req.url === '/session/ses_mock/message' && req.method === 'POST') return json(res, { parts: [{ type: 'text', text: 'Mock OpenCode response from DHS.' }] })
    res.writeHead(404); res.end('{}')
  })
}).listen(port, '127.0.0.1', () => console.log(`mock-opencode: listening on ${port}`))
