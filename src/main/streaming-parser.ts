import { parseXml } from './xml-parser'
import { createGpxProcessor } from './gpx-processor'
import { DataStore } from './data-store'
import type { ParseProgressData } from '../shared/types'

export async function parseStream(
  filePath: string,
  isGpx: boolean,
  callbacks: {
    onProgress: (data: ParseProgressData) => void
    onComplete: (result: { filePath: string; name: string; size: number }) => void
    onError: (error: string) => void
  }
): Promise<void> {
  const { onProgress, onComplete, onError } = callbacks

  try {
    let gpxProcessor: ReturnType<typeof createGpxProcessor> | null = null
    if (isGpx) {
      gpxProcessor = createGpxProcessor()
    }

    let currentTrkpt: { lat: string; lon: string; ele: string; time: string } | null = null
    let eleDepth = 0
    let timeDepth = 0

    const result = await parseXml(filePath, {
      stripNamespaces: isGpx,
      onProgress: (bytesRead, totalBytes) => {
        onProgress({ bytesRead, totalBytes, phase: 'parsing' })
      },
      onOpenTag: gpxProcessor ? (tagName, attrs) => {
        if (tagName === 'trkpt') {
          currentTrkpt = {
            lat: attrs['lat'] ?? '',
            lon: attrs['lon'] ?? '',
            ele: '',
            time: ''
          }
        } else if (tagName === 'ele') {
          eleDepth++
        } else if (tagName === 'time') {
          timeDepth++
        }
      } : undefined,
      onText: gpxProcessor ? (text) => {
        if (currentTrkpt) {
          if (eleDepth > 0) currentTrkpt.ele += text
          if (timeDepth > 0) currentTrkpt.time += text
        }
      } : undefined,
      onCloseTag: gpxProcessor ? (tagName) => {
        if (tagName === 'ele') eleDepth--
        else if (tagName === 'time') timeDepth--
        else if (tagName === 'trkpt' && currentTrkpt) {
          const lat = parseFloat(currentTrkpt.lat)
          const lon = parseFloat(currentTrkpt.lon)
          const time = new Date(currentTrkpt.time)
          const ele = currentTrkpt.ele ? parseFloat(currentTrkpt.ele) : null

          if (!isNaN(lat) && !isNaN(lon) && !isNaN(time.getTime())) {
            gpxProcessor.processTrkpt({ lat, lon, ele: ele !== null && !isNaN(ele) ? ele : null, time })
          }
          currentTrkpt = null
        }
      } : undefined
    })

    if (gpxProcessor) {
      DataStore.setGpxStats(gpxProcessor.getStats())
    }
    DataStore.setResult(result)

    const name = filePath.split('/').pop() || 'output'
    onComplete({ filePath: result.filePath, name, size: result.size })
  } catch (err) {
    onError((err as Error).message)
  }
}
