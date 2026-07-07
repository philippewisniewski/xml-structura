import { JsonFileReader, tryExtractPathFrom, type IndexTreeNode } from './json-file-reader'
import type { ParsedResult } from './xml-parser'
import type { GpxStats } from './gpx-processor'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

let parsedResult: ParsedResult | null = null
let cachedReader: JsonFileReader | null = null
let cachedJsonText: string | null = null
let gpxStats: GpxStats | null = null

function getReader(): JsonFileReader | null {
  if (!parsedResult) return null
  if (cachedReader?.getFilePath() === parsedResult.filePath) return cachedReader
  try {
    cachedReader?.close()
    const reader = new JsonFileReader(parsedResult.filePath, parsedResult.index)
    cachedReader = reader

    if (!reader.isLarge()) {
      cachedJsonText = reader.getText()
    }
    return reader
  } catch {
    return null
  }
}

export const DataStore = {
  setResult(result: ParsedResult): void {
    parsedResult = result
    cachedReader?.close()
    cachedReader = null
    cachedJsonText = null
  },

  setGpxStats(stats: GpxStats): void {
    gpxStats = stats
  },

  getFilePath(): string | null {
    return parsedResult?.filePath ?? null
  },

  get(): JsonValue | null {
    const reader = getReader()
    if (!reader) return null
    if (reader.isLarge()) return null
    if (cachedJsonText) {
      try {
        return JSON.parse(cachedJsonText) as JsonValue
      } catch {
        return null
      }
    }
    return reader.getData()
  },

  getText(): string | null {
    const reader = getReader()
    if (!reader) return null
    if (reader.isLarge()) return null
    return cachedJsonText
  },

  isLargeFile(): boolean {
    const reader = getReader()
    return reader ? reader.isLarge() : false
  },

  getFileSize(): number {
    return parsedResult?.size ?? 0
  },

  query(path: string): JsonValue | undefined {
    const reader = getReader()
    if (!reader) return undefined

    if (cachedJsonText) {
      try {
        const data = JSON.parse(cachedJsonText) as JsonValue
        const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean)
        return tryExtractPathFrom(data, parts)
      } catch {
        // fall through to reader.query
      }
    }

    return reader.query(path)
  },

  search(query: string, limit?: number): string[] {
    if (cachedJsonText) {
      const results: string[] = []
      const lowerQuery = query.toLowerCase()
      const lines = cachedJsonText.split('\n')
      for (const line of lines) {
        if (line.toLowerCase().includes(lowerQuery)) {
          results.push(line.trim())
          if (limit && results.length >= limit) break
        }
      }
      return results
    }

    const reader = getReader()
    if (!reader) return []
    return reader.search(query, limit)
  },

  getTopLevelKeys(): string[] {
    if (cachedJsonText) {
      const keys: string[] = []
      const regex = /"(\w+)":/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(cachedJsonText)) !== null) {
        if (!keys.includes(m[1])) keys.push(m[1])
      }
      return keys
    }

    const reader = getReader()
    if (!reader) return []
    return reader.getTopLevelKeys()
  },

  getParsed(): JsonValue | null {
    if (gpxStats) {
      return JSON.parse(JSON.stringify(gpxStats)) as JsonValue
    }
    const reader = getReader()
    if (!reader) return null
    return reader.getParsed()
  },

  readStartingBytes(byteCount: number): string | null {
    const reader = getReader()
    if (!reader) return null
    return reader.readStartingBytes(byteCount)
  },

  readBytes(start: number, length: number): string | null {
    const reader = getReader()
    if (!reader) return null
    return reader.readBytes(start, length)
  },

  getIndexTree(): IndexTreeNode | null {
    const reader = getReader()
    if (!reader) return null
    return reader.buildIndexTree()
  },

  clear(): void {
    cachedReader?.close()
    cachedReader = null
    cachedJsonText = null
    parsedResult = null
    gpxStats = null
  }
}


