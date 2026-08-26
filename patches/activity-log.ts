import { appendFile } from 'node:fs/promises'

export interface ActivityRecord {
  ts: string
  kind: 'http' | 'websocket'
  method?: string
  route: string
  status?: number
  durationMs?: number
  accepted?: boolean
}

/** Best-effort NDJSON logger; it never captures request or response payloads. */
export function createActivityLogger(path = process.env.DSH_ACTIVITY_LOG): (record: Omit<ActivityRecord, 'ts'>) => void {
  if (path === undefined || path === '') return () => {}
  return (record) => {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n'
    void appendFile(path, line, { encoding: 'utf8' }).catch(() => {})
  }
}
