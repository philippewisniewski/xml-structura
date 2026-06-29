import { ipcMain, dialog, app } from 'electron'
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync, spawn } from 'child_process'
import { XMLParser } from 'fast-xml-parser'
import type { FileResult, ParseResult, RecentFile, McpStatus } from '../shared/types'
import { startMcpServer as mcpStart, stopMcpServer as mcpStop, getMcpStatus as mcpStatus } from './mcp-server'

const tempFiles = new Set<string>()

app.on('will-quit', () => {
  for (const f of tempFiles) {
    try { unlinkSync(f) } catch { }
  }
  tempFiles.clear()
})

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (name: string) => ['Workout', 'WorkoutStatistics', 'MetadataEntry', 'Record', 'trkpt'].includes(name),
  processEntities: false
})

const gpxParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (name: string) => name === 'trkpt',
  processEntities: false
})

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseXmlGeneric(content: string): ParseResult {
  try {
    const data = xmlParser.parse(content)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: `XML parse error: ${(err as Error).message}` }
  }
}

function parseGpxGeneric(content: string): ParseResult {
  try {
    const raw = gpxParser.parse(content)
    const trkpts = (raw as any)?.gpx?.trk?.trkseg?.trkpt
    if (!trkpts || !Array.isArray(trkpts) || trkpts.length === 0) {
      return { success: true, data: raw }
    }

    const points: Array<{ lat: number; lon: number; ele: number | null; time: Date }> = []
    for (const pt of trkpts) {
      const lat = parseFloat(pt.lat)
      const lon = parseFloat(pt.lon)
      const time = new Date(pt.time)
      const ele = pt.ele != null ? parseFloat(String(pt.ele)) : null
      if (isNaN(lat) || isNaN(lon) || isNaN(time.getTime())) continue
      points.push({ lat, lon, ele: ele !== null && !isNaN(ele) ? ele : null, time })
    }

    if (points.length === 0) return { success: true, data: { raw, parsed: null } }

    const routePolyline: [number, number][] = points
      .filter((_, i) => i % 10 === 0)
      .map(pt => [pt.lat, pt.lon])

    const kmSplits: number[] = []
    const kmElevationGain: number[] = []
    const kmElevationLoss: number[] = []

    let cumulativeDist = 0
    let kmBoundary = 1
    let kmStartTime = points[0].time
    let prevPt = points[0]
    let kmElevGain = 0
    let kmElevLoss = 0

    for (let i = 1; i < points.length; i++) {
      const pt = points[i]
      cumulativeDist += haversine(prevPt.lat, prevPt.lon, pt.lat, pt.lon)

      if (pt.ele != null && prevPt.ele != null) {
        const delta = pt.ele - prevPt.ele
        if (delta > 0) kmElevGain += delta
        else kmElevLoss += Math.abs(delta)
      }

      if (cumulativeDist >= kmBoundary) {
        const elapsedMs = pt.time.getTime() - kmStartTime.getTime()
        const elapsedMin = elapsedMs / 1000 / 60
        if (elapsedMin > 0 && elapsedMin <= 12) {
          kmSplits.push(Math.round(elapsedMin * 60))
          kmElevationGain.push(Math.round(kmElevGain))
          kmElevationLoss.push(Math.round(kmElevLoss))
        }
        kmStartTime = pt.time
        kmBoundary++
        kmElevGain = 0
        kmElevLoss = 0
      }
      prevPt = pt
    }

    const result = {
      raw,
      parsed: {
        totalPoints: points.length,
        startLat: points[0].lat,
        startLon: points[0].lon,
        kmSplits,
        kmElevationGain,
        kmElevationLoss,
        routePolyline
      }
    }

    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: `GPX parse error: ${(err as Error).message}` }
  }
}

function getFileInfo(content: string): { size: number; lines: number } {
  return {
    size: new TextEncoder().encode(content).length,
    lines: content.split('\n').length
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('open-file', async (): Promise<FileResult | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'XML/GPX', extensions: ['xml', 'gpx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const path = result.filePaths[0]
    const content = readFileSync(path, 'utf-8')
    const name = path.split('/').pop() || path.split('\\').pop() || 'unknown'
    return {
      content,
      name,
      path,
      size: new TextEncoder().encode(content).length
    }
  })

  ipcMain.handle('read-file', async (_, path: string): Promise<FileResult | null> => {
    try {
      if (!existsSync(path)) return null
      const content = readFileSync(path, 'utf-8')
      const name = path.split('/').pop() || path.split('\\').pop() || 'unknown'
      return {
        content,
        name,
        size: new TextEncoder().encode(content).length
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('fetch-url', async (_, url: string): Promise<FileResult | null> => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const content = await response.text()
      const name = url.split('/').pop() || 'response.xml'
      return {
        content,
        name,
        size: new TextEncoder().encode(content).length
      }
    } catch (err) {
      throw new Error(`Failed to fetch URL: ${(err as Error).message}`)
    }
  })

  ipcMain.handle('parse-xml', (_, content: string): ParseResult => {
    return parseXmlGeneric(content)
  })

  ipcMain.handle('parse-gpx', (_, content: string): ParseResult => {
    return parseGpxGeneric(content)
  })

  ipcMain.handle('get-file-info', (_, content: string) => {
    return getFileInfo(content)
  })

  ipcMain.handle('save-file', async (_, content: string, defaultName: string): Promise<boolean> => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    try {
      writeFileSync(result.filePath, content, 'utf-8')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('detect-editors', (): string | null => {
    const editors = [
      { name: 'VS Code', bin: 'code' },
      { name: 'Cursor', bin: 'cursor' },
      { name: 'Zed', bin: 'zed' },
    ]
    for (const editor of editors) {
      try {
        execFileSync('which', [editor.bin], { encoding: 'utf-8' })
        return editor.name
      } catch {
        continue
      }
    }
    return null
  })

  ipcMain.handle('open-in-editor', async (_, content: string): Promise<boolean> => {
    for (const bin of ['code', 'cursor', 'zed']) {
      try {
        execFileSync('which', [bin], { encoding: 'utf-8' })
        const tmpFile = join(tmpdir(), `xml2json-${Date.now()}.json`)
        writeFileSync(tmpFile, content, 'utf-8')
        tempFiles.add(tmpFile)
        spawn(bin, [tmpFile], { detached: true, stdio: 'ignore' }).unref()
        return true
      } catch {
        continue
      }
    }
    return false
  })

  ipcMain.handle('start-mcp-server', async (_event, port: number, data: unknown): Promise<{ port: number }> => {
    try {
      const result = await mcpStart(port, data)
      return result
    } catch (err) {
      console.error('Failed to start MCP server:', err)
      throw err
    }
  })

  ipcMain.handle('stop-mcp-server', async () => {
    await mcpStop()
  })

  ipcMain.handle('get-mcp-status', async (): Promise<McpStatus> => {
    return mcpStatus()
  })
}

