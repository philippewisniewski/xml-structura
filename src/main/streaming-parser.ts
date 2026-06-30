import sax from 'sax'
import type { Tag } from 'sax'
import { createReadStream, writeFileSync } from 'fs'
import { stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { StreamingJsonWriter } from './streaming-json-writer'
import { DataStore } from './data-store'
import type { ParseProgressData } from '../shared/types'

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

  let totalBytes = 0
  let bytesRead = 0

  try {
    const fileStat = await stat(filePath)
    totalBytes = fileStat.size
  } catch {
    onError('Cannot access file')
    return
  }

  const tmpJsonFile = join(tmpdir(), `structura-${Date.now()}.json`)
  const tmpIdxFile = tmpJsonFile + '.idx'

  const indexEntries: string[] = []

  const writer = new StreamingJsonWriter(tmpJsonFile, (keyPath, valueStart) => {
    indexEntries.push(`${keyPath}\t${valueStart}`)
  })

  const parser = sax.parser(true, { trim: true })

  // GPX tracking state
  let currentTrkpt: { lat: string; lon: string; ele: string; time: string } | null = null
  let eleDepth = 0
  let timeDepth = 0
  let pointCount = 0
  let firstPt: { lat: number; lon: number } | null = null
  let prevPt: { lat: number; lon: number; ele: number | null; time: Date } | null = null
  let cumulativeDist = 0
  let kmBoundary = 1
  let kmStartTime: Date | null = null
  let kmElevGain = 0
  let kmElevLoss = 0
  const kmSplits: number[] = []
  const kmElevationGain: number[] = []
  const kmElevationLoss: number[] = []
  const routePolyline: [number, number][] = []

  function processTrkpt(pt: { lat: number; lon: number; ele: number | null; time: Date }): void {
    pointCount++
    if (!firstPt) {
      firstPt = { lat: pt.lat, lon: pt.lon }
      kmStartTime = pt.time
    }

    if (pointCount % 10 === 0) {
      routePolyline.push([pt.lat, pt.lon])
    }

    if (prevPt) {
      const dist = haversine(prevPt.lat, prevPt.lon, pt.lat, pt.lon)
      cumulativeDist += dist

      if (pt.ele != null && prevPt.ele != null) {
        const delta = pt.ele - prevPt.ele
        if (delta > 0) kmElevGain += delta
        else kmElevLoss += Math.abs(delta)
      }

      if (cumulativeDist >= kmBoundary) {
        if (kmStartTime) {
          const elapsedMs = pt.time.getTime() - kmStartTime.getTime()
          const elapsedMin = elapsedMs / 1000 / 60
          if (elapsedMin > 0 && elapsedMin <= 12) {
            kmSplits.push(Math.round(elapsedMin * 60))
            kmElevationGain.push(Math.round(kmElevGain))
            kmElevationLoss.push(Math.round(kmElevLoss))
          }
        }
        kmStartTime = pt.time
        kmBoundary++
        kmElevGain = 0
        kmElevLoss = 0
      }
    }

    prevPt = pt
  }

  parser.onopentag = (tag: Tag) => {
    if (isGpx) {
      if (tag.name === 'trkpt') {
        currentTrkpt = {
          lat: tag.attributes['lat'],
          lon: tag.attributes['lon'],
          ele: '',
          time: ''
        }
      } else if (tag.name === 'ele') {
        eleDepth++
      } else if (tag.name === 'time') {
        timeDepth++
      }
    }

    writer.openTag(tag.name, tag.attributes)
  }

  parser.ontext = (text: string) => {
    writer.setText(text)

    if (isGpx && currentTrkpt) {
      if (eleDepth > 0) currentTrkpt.ele += text
      if (timeDepth > 0) currentTrkpt.time += text
    }
  }

  parser.oncdata = (text: string) => {
    writer.setText(text)

    if (isGpx && currentTrkpt) {
      if (eleDepth > 0) currentTrkpt.ele += text
      if (timeDepth > 0) currentTrkpt.time += text
    }
  }

  parser.onclosetag = (tagName: string) => {
    if (isGpx) {
      if (tagName === 'ele') {
        eleDepth--
      } else if (tagName === 'time') {
        timeDepth--
      } else if (tagName === 'trkpt' && currentTrkpt) {
        const lat = parseFloat(currentTrkpt.lat)
        const lon = parseFloat(currentTrkpt.lon)
        const time = new Date(currentTrkpt.time)
        const ele = currentTrkpt.ele ? parseFloat(currentTrkpt.ele) : null

        if (!isNaN(lat) && !isNaN(lon) && !isNaN(time.getTime())) {
          processTrkpt({ lat, lon, ele: ele !== null && !isNaN(ele) ? ele : null, time })
        }
        currentTrkpt = null
      }
    }

    writer.closeTag(tagName)
  }

  parser.onerror = (err: Error) => {
    onError(err.message)
  }

  parser.onend = () => {
    if (isGpx && pointCount > 0 && firstPt) {
      const parsed = {
        totalPoints: pointCount,
        startLat: firstPt.lat,
        startLon: firstPt.lon,
        kmSplits,
        kmElevationGain,
        kmElevationLoss,
        routePolyline
      }
      const beforePos = writer.getPos()
      const rawText = `, "_parsed": ${JSON.stringify(parsed)}`
      writer.appendRaw(rawText)
      const keyEndLen = Buffer.byteLength(', "_parsed": ', 'utf-8')
      indexEntries.push(`$._parsed\t${beforePos + keyEndLen}`)
    }
  }

  const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 65536 })

  for await (const chunk of stream) {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8')
    bytesRead += Buffer.byteLength(text, 'utf-8')
    parser.write(text)
    onXmlChunk(text)
    onProgress({ bytesRead, totalBytes, phase: 'parsing' })
  }

  parser.close()

  writer.close()

  // Embed array counts into existing [] index lines
  const arrayCounts = writer.getArrayCounts()
  const finalIdxLines = indexEntries.map(line => {
    const tabIdx = line.indexOf('\t')
    if (tabIdx === -1) return line
    const path = line.substring(0, tabIdx)
    if (path.endsWith('[]')) {
      const parentPath = path.slice(0, -2)
      const count = arrayCounts.get(parentPath)
      if (count !== undefined) {
        return `${path}\t${line.substring(tabIdx + 1)}\t${count}`
      }
    }
    return line
  })

  if (finalIdxLines.length > 0) {
    writeFileSync(tmpIdxFile, finalIdxLines.join('\n') + '\n', 'utf-8')
  }

  const jsonSize = await stat(tmpJsonFile).then(s => s.size).catch(() => 0)
  DataStore.setFilePath(tmpJsonFile)

  const name = filePath.split('/').pop() || 'output'
  onComplete({ filePath: tmpJsonFile, name, size: jsonSize })
}
