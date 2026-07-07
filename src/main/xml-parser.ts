import sax from 'sax'
import { createReadStream, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { StreamingJsonWriter } from './streaming-json-writer'
import type { TrackPoint } from './gpx-processor'

export interface ParsedResult {
  filePath: string
  name: string
  size: number
  index: Map<string, number>
}

export interface BeforeCloseContext {
  appendRaw: (s: string) => void
  getPos: () => number
  addIndexEntry: (path: string, offset: number) => void
}

export interface ParserOptions {
  stripNamespaces?: boolean
  onTrkpt?: (pt: TrackPoint) => void
  onProgress?: (bytesRead: number, totalBytes: number) => void
  onChunk?: (chunk: string) => void
  onBeforeClose?: (ctx: BeforeCloseContext) => void
}

function stripName(name: string): string {
  return name.includes(':') ? name.split(':').pop()! : name
}

export function parseXml(
  filePath: string,
  options?: ParserOptions
): Promise<ParsedResult> {
  const strip = options?.stripNamespaces ?? false
  const onTrkpt = options?.onTrkpt
  const onBeforeClose = options?.onBeforeClose

  const tmpFile = join(tmpdir(), `structura-${Date.now()}.json`)
  const indexEntries: Array<{ path: string; offset: number }> = []
  const writer = new StreamingJsonWriter(tmpFile, (path, offset) => {
    indexEntries.push({ path, offset })
  })

  return new Promise((resolve, reject) => {
    let totalBytes = 0
    let bytesRead = 0

    try {
      totalBytes = statSync(filePath).size
    } catch {
      writer.discard()
      reject(new Error('Cannot access file'))
      return
    }

    let currentTrkpt: { lat: string; lon: string; ele: string; time: string } | null = null
    let eleDepth = 0
    let timeDepth = 0

    const saxStream = sax.createStream(true, { xmlns: true, trim: true })

    saxStream.on('opentag', (node: sax.Tag | sax.QualifiedTag) => {
      const qualified = node as sax.QualifiedTag
      const tagName = strip && qualified.local ? qualified.local : node.name

      if (onTrkpt && tagName === 'trkpt') {
        const attrs = qualified.attributes || {}
        const attrArr = Object.values(attrs)
        currentTrkpt = {
          lat: attrArr.find(a => (strip ? a.local === 'lat' : a.name === 'lat'))?.value ?? '',
          lon: attrArr.find(a => (strip ? a.local === 'lon' : a.name === 'lon'))?.value ?? '',
          ele: '',
          time: ''
        }
      } else if (onTrkpt && (tagName === 'ele' || tagName === 'time')) {
        if (tagName === 'ele') eleDepth++
        if (tagName === 'time') timeDepth++
      }

      const attrs: Record<string, string> = {}
      if (qualified.attributes) {
        for (const attr of Object.values(qualified.attributes)) {
          if (attr.name.startsWith('xmlns')) continue
          const attrName = strip && attr.local ? attr.local : attr.name
          attrs[attrName] = attr.value
        }
      }

      writer.openTag(tagName, attrs)
    })

    saxStream.on('text', (text: string) => {
      writer.setText(text)

      if (onTrkpt && currentTrkpt) {
        if (eleDepth > 0) currentTrkpt.ele += text
        if (timeDepth > 0) currentTrkpt.time += text
      }
    })

    saxStream.on('closetag', (qualifiedName: string) => {
      const tagName = strip ? stripName(qualifiedName) : qualifiedName

      if (onTrkpt) {
        if (tagName === 'ele') eleDepth--
        if (tagName === 'time') timeDepth--

        if (tagName === 'trkpt' && currentTrkpt) {
          const lat = parseFloat(currentTrkpt.lat)
          const lon = parseFloat(currentTrkpt.lon)
          const time = new Date(currentTrkpt.time)
          const ele = currentTrkpt.ele ? parseFloat(currentTrkpt.ele) : null

          if (!isNaN(lat) && !isNaN(lon) && !isNaN(time.getTime())) {
            onTrkpt({ lat, lon, ele: ele !== null && !isNaN(ele) ? ele : null, time })
          }
          currentTrkpt = null
        }
      }

      writer.closeTag(tagName)
    })

    saxStream.on('error', (err: Error) => {
      writer.discard()
      reject(err)
    })

    saxStream.on('end', () => {
      if (onBeforeClose) {
        onBeforeClose({
          appendRaw: (s) => writer.appendRaw(s),
          getPos: () => writer.getPos(),
          addIndexEntry: (path, offset) => {
            indexEntries.push({ path, offset })
          }
        })
      }

      writer.close()

      const index = new Map<string, number>()
      for (const { path, offset } of indexEntries) {
        index.set(path, offset)
      }

      const name = filePath.split('/').pop() || 'output'
      const size = statSync(tmpFile).size

      resolve({ filePath: tmpFile, name, size, index })
    })

    const onProgress = options?.onProgress
    const onChunk = options?.onChunk
    const readStream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 65536 })
    readStream.on('data', (chunk: string) => {
      bytesRead += Buffer.byteLength(chunk, 'utf-8')
      if (onProgress) onProgress(bytesRead, totalBytes)
      if (onChunk) onChunk(chunk)
    })
    readStream.pipe(saxStream)
  })
}
