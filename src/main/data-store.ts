import { JsonFileReader, type IndexTreeNode } from './json-file-reader'
import type { ParsedResult } from './xml-parser'
import type { GpxStats } from './gpx-processor'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

let parsedResult: ParsedResult | null = null
let cachedReader: JsonFileReader | null = null
let gpxStats: GpxStats | null = null

function getReader(): JsonFileReader | null {
  if (!parsedResult) return null
  if (cachedReader?.getFilePath() === parsedResult.filePath) return cachedReader
  try {
    cachedReader?.close()
    const reader = new JsonFileReader(parsedResult.filePath, parsedResult.index)
    cachedReader = reader
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
  },

  setGpxStats(stats: GpxStats): void {
    gpxStats = stats
  },

  getFilePath(): string | null {
    return parsedResult?.filePath ?? null
  },

  get(): JsonValue | null {
    const reader = getReader()
    if (!reader || reader.isLarge()) return null
    return reader.getData()
  },

  getText(): string | null {
    const reader = getReader()
    if (!reader || reader.isLarge()) return null
    return reader.getText()
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
    return reader.query(path)
  },

  search(query: string, limit?: number): string[] {
    const reader = getReader()
    if (!reader) return []
    return reader.search(query, limit)
  },

  getTopLevelKeys(): string[] {
    const reader = getReader()
    if (!reader) return []
    return reader.getTopLevelKeys()
  },

  getParsed(): JsonValue | null {
    if (gpxStats) {
      return JSON.parse(JSON.stringify(gpxStats)) as JsonValue
    }
    return null
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
    parsedResult = null
    gpxStats = null
  }
}


