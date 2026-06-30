import { JsonFileReader, type JsonFileReader as IReader, type IndexTreeNode } from './json-file-reader'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

let filePath: string | null = null
let cachedReader: IReader | null = null

function getReader(): IReader | null {
  if (!filePath) return null
  if (cachedReader?.getFilePath() === filePath) return cachedReader
  try {
    cachedReader?.close()
    const reader = new JsonFileReader(filePath)
    cachedReader = reader
    return reader
  } catch {
    return null
  }
}

export const DataStore = {
  setFilePath(p: string): void {
    filePath = p
    cachedReader?.close()
    cachedReader = null
  },
  getFilePath(): string | null {
    return filePath
  },
  /** For small files: returns full parsed JSON */
  get(): JsonValue | null {
    const reader = getReader()
    if (!reader) return null
    if (reader.isLarge()) return null
    return reader.getData()
  },
  /** For small files: returns full JSON text */
  getText(): string | null {
    const reader = getReader()
    if (!reader) return null
    return reader.getText()
  },
  /** Whether the file is too large to load in memory */
  isLargeFile(): boolean {
    const reader = getReader()
    return reader ? reader.isLarge() : false
  },
  /** Get the file size */
  getFileSize(): number {
    const reader = getReader()
    return reader ? reader.getFileSize() : 0
  },
  /** Query a specific path in the JSON */
  query(path: string): JsonValue | undefined {
    const reader = getReader()
    if (!reader) return undefined
    return reader.query(path)
  },
  /** Search for matching values */
  search(query: string, limit?: number): string[] {
    const reader = getReader()
    if (!reader) return []
    return reader.search(query, limit)
  },
  /** Get top-level keys */
  getTopLevelKeys(): string[] {
    const reader = getReader()
    if (!reader) return []
    return reader.getTopLevelKeys()
  },
  /** Get _parsed data (GPX files) */
  getParsed(): JsonValue | null {
    const reader = getReader()
    if (!reader) return null
    return reader.getParsed()
  },
  /** Read raw bytes starting from a position */
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
    filePath = null
  }
}
