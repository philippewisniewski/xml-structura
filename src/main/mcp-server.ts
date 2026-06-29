import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from 'http'
import type { Server } from 'http'
import { z } from 'zod'

let server: { mcp: McpServer; transport: StreamableHTTPServerTransport; http: Server; port: number } | null = null

function computeStats(data: unknown): Record<string, number> {
  const counts: Record<string, number> = {}

  function walk(value: unknown, path: string): void {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      const key = `${path}[]`
      counts[key] = (counts[key] || 0) + value.length
      value.forEach(item => walk(item, path))
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        counts[k] = (counts[k] || 0) + 1
        walk(v, `${path}.${k}`)
      }
    }
  }

  walk(data, '$')
  return counts
}

function inferSchema(data: unknown): unknown {
  function getType(value: unknown): string | Record<string, unknown> | unknown[] {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (Array.isArray(value)) {
      if (value.length === 0) return 'array'
      const itemTypes = [...new Set(value.map(v => JSON.stringify(getType(v))))]
      return { type: 'array', items: itemTypes.length === 1 ? JSON.parse(itemTypes[0]) : itemTypes }
    }
    if (typeof value === 'object') {
      const props: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        props[k] = getType(v)
      }
      return { type: 'object', properties: props }
    }
    return typeof value
  }

  return getType(data)
}

function searchInData(data: unknown, query: string): unknown[] {
  const results: unknown[] = []
  const lowerQuery = query.toLowerCase()

  function walk(value: unknown): void {
    if (value === null || value === undefined) return
    if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
      results.push(value)
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach(walk)
      } else {
        for (const v of Object.values(value as Record<string, unknown>)) {
          if (typeof v === 'string' && v.toLowerCase().includes(lowerQuery)) {
            results.push(v)
          }
          walk(v)
        }
      }
    }
  }

  walk(data)
  return results
}

function findJsonPath(data: unknown, path: string): unknown {
  const parts = path.replace(/^(\$|\.)/, '').split(/\.|(?=\[)/)
  let current: unknown = data

  for (const part of parts) {
    if (current === null || current === undefined) return undefined

    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
    const objMatch = part.match(/^(\w+)$/)

    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch
      const index = parseInt(indexStr, 10)
      const arr = (current as Record<string, unknown>)[key]
      if (!Array.isArray(arr) || index >= arr.length) return undefined
      current = arr[index]
    } else if (objMatch) {
      const key = objMatch[1]
      if (typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[key]
    } else if (part === '') {
      continue
    } else {
      const index = parseInt(part.replace('[', '').replace(']', ''), 10)
      if (!isNaN(index) && Array.isArray(current)) {
        if (index >= current.length) return undefined
        current = current[index]
      } else {
        return undefined
      }
    }
  }

  return current
}

export async function startMcpServer(port: number, data: unknown): Promise<{ port: number }> {
  if (server) {
    await stopMcpServer()
  }

  const transport = new StreamableHTTPServerTransport()

  const mcp = new McpServer({ name: 'xml2json', version: '0.1.0' })

  const rawJson = JSON.stringify(data, null, 2)

  mcp.resource(
    'Current Data (Raw)',
    'xml2json://current/raw',
    { description: 'Full parsed JSON of the currently loaded XML/GPX file', mimeType: 'application/json' },
    async () => ({
      contents: [{ uri: 'xml2json://current/raw', text: rawJson, mimeType: 'application/json' }]
    })
  )

  mcp.resource(
    'Current Data (Stats)',
    'xml2json://current/stats',
    { description: 'Element counts and statistics about the current data' },
    async () => ({
      contents: [{ uri: 'xml2json://current/stats', text: JSON.stringify(computeStats(data), null, 2), mimeType: 'application/json' }]
    })
  )

  mcp.tool(
    'search',
    'Search the parsed data for values matching a query string',
    { query: z.string().describe('The text to search for (case-insensitive)') },
    async (args) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(searchInData(data, args.query), null, 2) }]
    })
  )

  mcp.tool(
    'query',
    'Query a JSONPath-like expression against the parsed data',
    { path: z.string().describe('Path expression e.g. $.Workout[0] or Workout.0.duration') },
    async (args) => {
      const result = findJsonPath(data, args.path)
      return {
        content: [{ type: 'text' as const, text: result !== undefined ? JSON.stringify(result, null, 2) : 'Not found' }]
      }
    }
  )

  mcp.tool(
    'schema',
    'Infer the schema/structure of the parsed data',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(inferSchema(data), null, 2) }]
    })
  )

  const httpServer = createServer(async (req, res) => {
    try {
      let parsedBody: unknown = undefined
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const body = Buffer.concat(chunks).toString('utf-8')
        if (body) parsedBody = JSON.parse(body)
      }
      await transport.handleRequest(req, res, parsedBody)
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500)
        res.end(JSON.stringify({ error: String(err) }))
      }
    }
  })

  await mcp.connect(transport)

  const maxPort = port + 10

  return new Promise((resolve, reject) => {
    function tryListen(currentPort: number) {
      httpServer.listen(currentPort, '127.0.0.1', () => {
        server = { mcp, transport, http: httpServer, port: currentPort }
        resolve({ port: currentPort })
      })
      httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE' && currentPort < maxPort) {
          httpServer.removeAllListeners('error')
          tryListen(currentPort + 1)
        } else {
          reject(err)
        }
      })
    }
    tryListen(port)
  })
}

export async function stopMcpServer(): Promise<void> {
  if (!server) return
  try {
    await server.mcp.close()
  } catch { }
  server.http.close()
  server = null
}

export function getMcpStatus(): { running: boolean; port: number | null } {
  if (server) {
    return { running: true, port: server.port }
  }
  return { running: false, port: null }
}
