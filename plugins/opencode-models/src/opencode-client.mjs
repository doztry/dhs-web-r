const DEFAULT_TIMEOUT_MS = 120_000

function requireUrl(raw) {
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('OPENCODE_BASE_URL must use http or https')
  url.hash = ''
  return url
}

export class OpenCodeClient {
  constructor({ baseURL = process.env.OPENCODE_BASE_URL ?? 'http://127.0.0.1:4096', apiKey = process.env.OPENCODE_API_KEY, timeoutMs = 120_000 } = {}) {
    this.baseURL = requireUrl(baseURL)
    this.apiKey = apiKey
    this.timeoutMs = timeoutMs
  }

  async request(path, { method = 'GET', body, signal } = {}) {
    const url = new URL(path, this.baseURL)
    const headers = { accept: 'application/json' }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (this.apiKey !== undefined) headers.authorization = `Bearer ${this.apiKey}`
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    let response
    try {
      response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: combined })
    } catch (error) {
      throw new Error(`OpenCode upstream request failed: ${error instanceof Error ? error.message : 'network error'}`)
    }
    const text = await response.text()
    let data
    try { data = text === '' ? undefined : JSON.parse(text) } catch { data = undefined }
    if (!response.ok) throw new Error(`OpenCode upstream returned HTTP ${response.status}`)
    return data
  }

  health(signal) { return this.request('/global/health', { signal }) }
  providers(signal) { return this.request('/provider', { signal }) }
  models(signal) { return this.request('/config/providers', { signal }) }
  createSession(title, signal) { return this.request('/session', { method: 'POST', body: { title }, signal }) }
  prompt(sessionId, body, signal) { return this.request(`/session/${encodeURIComponent(sessionId)}/message`, { method: 'POST', body, signal }) }
}

export function normalizeTextContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) throw new Error('message content must be a string or array')
  return content.map(part => {
    if (typeof part === 'string') return part
    if (part?.type === 'text' && typeof part.text === 'string') return part.text
    throw new Error('only text content is supported by the OpenCode bridge')
  }).join('')
}
