import { parseXml, type BeforeCloseContext } from './xml-parser'
import { createGpxProcessor } from './gpx-processor'
import { DataStore } from './data-store'
import type { ParseProgressData } from '../shared/types'

export async function parseStream(
  filePath: string,
  isGpx: boolean,
  callbacks: {
    onProgress: (data: ParseProgressData) => void
    onXmlChunk: (chunk: string) => void
    onComplete: (result: { filePath: string; name: string; size: number }) => void
    onError: (error: string) => void
  }
): Promise<void> {
  const { onProgress, onXmlChunk, onComplete, onError } = callbacks

  try {
    let gpxProcessor: ReturnType<typeof createGpxProcessor> | null = null
    if (isGpx) {
      gpxProcessor = createGpxProcessor()
    }

    const result = await parseXml(filePath, {
      stripNamespaces: isGpx,
      onTrkpt: gpxProcessor ? (pt) => gpxProcessor.processTrkpt(pt) : undefined,
      onProgress: (bytesRead, totalBytes) => {
        onProgress({ bytesRead, totalBytes, phase: 'parsing' })
      },
      onChunk: (chunk) => { onXmlChunk(chunk) },
      onBeforeClose: gpxProcessor ? (ctx: BeforeCloseContext) => {
        const stats = gpxProcessor.getStats()
        DataStore.setGpxStats(stats)
        const beforePos = ctx.getPos()
        const rawText = `,\n  "_parsed": ${JSON.stringify(stats)}`
        ctx.appendRaw(rawText)
        const keyLen = Buffer.byteLength(',\n  "_parsed": ', 'utf-8')
        ctx.addIndexEntry('$._parsed', beforePos + keyLen)
      } : undefined
    })

    DataStore.setResult(result)

    const name = filePath.split('/').pop() || 'output'
    onComplete({ filePath: result.filePath, name, size: result.size })
  } catch (err) {
    onError((err as Error).message)
  }
}
