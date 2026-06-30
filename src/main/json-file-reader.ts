import { openSync, readSync, closeSync, statSync, existsSync, readFileSync } from 'fs'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const LARGE_THRESHOLD = 50 * 1024 * 1024

interface IndexEntry {
  start: number
  arrayCount?: number
}

function readSlice(fd: number, start: number, size: number): string {
  const buf = Buffer.alloc(size)
  const read = readSync(fd, buf, 0, size, start)
  return buf.toString('utf-8', 0, read)
}

function parseIndexLine(line: string): { path: string; start: number; count?: number } | null {
  const parts = line.split('\t')
  if (parts.length < 2) return null
  const path = parts[0]
  const start = parseInt(parts[1], 10)
  if (isNaN(start)) return null
  const count = parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0
  return { path, start, count: count > 0 ? count : undefined }
}

function valueEnd(fd: number, start: number, fileSize: number): number {
  const ch = readSlice(fd, start, 1)
  if (ch === '{' || ch === '[') {
    const open = ch
    const close = ch === '{' ? '}' : ']'
    let depth = 1
    let pos = start + 1
    while (depth > 0 && pos < fileSize) {
      const c = readSlice(fd, pos, 1)
      if (!c) break
      if (c === '"') {
        // skip string
        pos++
        while (pos < fileSize) {
          const sc = readSlice(fd, pos, 1)
          if (sc === '\\') { pos += 2; continue }
          if (sc === '"') { pos++; break }
          pos++
        }
      } else {
        if (c === open) depth++
        if (c === close) depth--
        pos++
      }
    }
    return pos
  }
  if (ch === '"') {
    let pos = start + 1
    while (pos < fileSize) {
      const c = readSlice(fd, pos, 1)
      if (c === '\\') { pos += 2; continue }
      if (c === '"') { pos++; return pos }
      pos++
    }
    return fileSize
  }
  let pos = start
  while (pos < fileSize) {
    const c = readSlice(fd, pos, 1)
    if (c === ',' || c === '}' || c === ']' || c === ' ' || c === '\n' || c === '\r' || c === '\t') return pos
    pos++
  }
  return fileSize
}

function readCompleteValue(fd: number, start: number, fileSize: number): string {
  const end = valueEnd(fd, start, fileSize)
  return readSlice(fd, start, end - start)
}

export class JsonFileReader {
  private fd: number
  private fileSize: number
  private index: Map<string, IndexEntry> = new Map()

  constructor(private filePath: string) {
    this.fd = openSync(filePath, 'r')
    this.fileSize = statSync(filePath).size
    this.loadIndex()
  }

  private loadIndex(): void {
    const indexPath = this.filePath + '.idx'
    if (!existsSync(indexPath)) return
    try {
      const content = readFileSync(indexPath, 'utf-8')
      for (const line of content.split('\n').filter(Boolean)) {
        const entry = parseIndexLine(line)
        if (entry) this.index.set(entry.path, { start: entry.start, arrayCount: entry.count })
      }
    } catch {}
  }

  isLarge(): boolean {
    return this.fileSize > LARGE_THRESHOLD
  }

  getFilePath(): string {
    return this.filePath
  }

  getFileSize(): number {
    return this.fileSize
  }

  /** Returns full parsed data for small files */
  getData(): JsonValue | null {
    if (this.isLarge()) return null
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as JsonValue
    } catch {
      return null
    }
  }

  /** Returns full JSON text for small files */
  getText(): string | null {
    if (this.isLarge()) return null
    try {
      return readFileSync(this.filePath, 'utf-8')
    } catch {
      return null
    }
  }

  /** Lookup a key path using the index, fall back to scanning */
  query(path: string): JsonValue | undefined {
    const entry = this.index.get(path)
    if (entry) {
      try {
        const raw = readCompleteValue(this.fd, entry.start, this.fileSize)
        return JSON.parse(raw) as JsonValue
      } catch {
        return undefined
      }
    }

    // Try without array indices: $.a.b[0].c → $.a.b.c
    const strippedPath = path.replace(/\[\d+\]/g, '')
    if (strippedPath !== path) {
      const strippedEntry = this.index.get(strippedPath)
      if (strippedEntry) {
        try {
          const raw = readCompleteValue(this.fd, strippedEntry.start, this.fileSize)
          return JSON.parse(raw) as JsonValue
        } catch {
          return undefined
        }
      }
    }

    // Try parent path from index: $.a.b[0].c → find $.a.b entry, read that context
    const arrayMatch = path.match(/^(.*?\.\w+)\[\d+\]/)
    if (arrayMatch) {
      const parentPath = arrayMatch[1]
      const parentEntry = this.index.get(parentPath)
      if (parentEntry) {
        const afterBracket = path.substring(arrayMatch[0].length)
        if (afterBracket) {
          const raw = readCompleteValue(this.fd, parentEntry.start, this.fileSize)
          try {
            const parent = JSON.parse(raw) as JsonValue
            const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean)
            return tryExtractPathFrom(parent, parts)
          } catch {}
        }
      }
    }

    return this.scanQuery(path)
  }

  private scanQuery(path: string): JsonValue | undefined {
    const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean)
    if (parts.length === 0) return this.isLarge() ? undefined : this.getData() ?? undefined

    for (let readSize = 1024 * 1024; readSize <= 1024 * 1024 * 500; readSize *= 2) {
      const chunk = readSlice(this.fd, 0, Math.min(readSize, this.fileSize))
      const val = tryExtractPath(chunk, parts)
      if (val !== undefined) return val
      if (readSize >= this.fileSize) break
    }
    return undefined
  }

  /** Extract _parsed from the end of the file (GPX files) */
  getParsed(): JsonValue | null {
    const entry = this.index.get('$._parsed')
    if (entry) {
      try {
        const raw = readCompleteValue(this.fd, entry.start, this.fileSize)
        return JSON.parse(raw) as JsonValue
      } catch {
        return null
      }
    }
    return null
  }

  /** Search values in the file */
  search(query: string, limit = 200): string[] {
    const results: string[] = []
    const lowerQuery = query.toLowerCase()
    const chunkSize = 65536
    let pos = 0
    let leftover = ''

    while (pos < this.fileSize && results.length < limit) {
      const remaining = this.fileSize - pos
      const size = Math.min(chunkSize, remaining)
      const chunk = readSlice(this.fd, pos, size)
      pos += size
      const combined = leftover + chunk
      const parts = combined.split('\n')
      for (let i = 0; i < parts.length - 1; i++) {
        const line = parts[i].trim()
        if (line && line.toLowerCase().includes(lowerQuery)) {
          results.push(line)
          if (results.length >= limit) return results
        }
      }
      leftover = parts[parts.length - 1]
    }
    if (leftover.trim() && leftover.toLowerCase().includes(lowerQuery) && results.length < limit) {
      results.push(leftover.trim())
    }
    return results
  }

  getTopLevelKeys(): string[] {
    if (this.index.size > 0) {
      const keys: string[] = []
      for (const path of this.index.keys()) {
        const match = path.match(/^\$\.(\w+)$/)
        if (match) keys.push(match[1])
      }
      if (keys.length > 0) return keys
    }
    const firstChunk = readSlice(this.fd, 0, Math.min(this.fileSize, 65536))
    const keys: string[] = []
    const regex = /"(\w+)":/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(firstChunk)) !== null) {
      if (!keys.includes(m[1])) keys.push(m[1])
    }
    return keys
  }

  readStartingBytes(byteCount: number): string {
    const size = Math.min(byteCount, this.fileSize)
    return readSlice(this.fd, 0, size)
  }

  readBytes(start: number, length: number): string {
    const clampedStart = Math.max(0, Math.min(start, this.fileSize))
    const size = Math.min(length, this.fileSize - clampedStart)
    if (size <= 0) return ''
    return readSlice(this.fd, clampedStart, size)
  }

  buildIndexTree(): IndexTreeNode {
    const paths = Array.from(this.index.keys())

    // Detect array paths (those ending with '[]')
    const arrayPaths = new Set<string>()
    const cleanPaths: string[] = []
    for (const p of paths) {
      if (p.endsWith('[]')) {
        arrayPaths.add(p.slice(0, -2))
      } else {
        cleanPaths.push(p)
      }
    }

    // Build a trie from clean paths
    interface TrieNode { name: string; path: string; children: Map<string, TrieNode> }
    const root: TrieNode = { name: '$', path: '$', children: new Map() }

    for (const p of cleanPaths) {
      const segments = p.replace(/^\$\.?/, '').split('.').filter(Boolean)
      let current = root
      for (const seg of segments) {
        if (!current.children.has(seg)) {
          const segPath = current.path === '$' ? '$.' + seg : current.path + '.' + seg
          current.children.set(seg, { name: seg, path: segPath, children: new Map() })
        }
        current = current.children.get(seg)!
      }
    }

    const convert = (node: typeof root): IndexTreeNode => {
      const childArr: IndexTreeNode[] = []
      for (const [, child] of node.children) {
        childArr.push(convert(child))
      }
      const hasArray = arrayPaths.has(node.path)
      const isLeaf = childArr.length === 0
      const nodeType = hasArray ? 'array' : isLeaf ? 'scalar' : 'object'
      let childCount = childArr.length
      if (hasArray) {
        const arrayEntry = this.index.get(node.path + '[]')
        if (arrayEntry && arrayEntry.arrayCount && arrayEntry.arrayCount > 0) {
          childCount = arrayEntry.arrayCount
        }
      }
      return {
        name: node.name,
        path: node.path,
        nodeType,
        children: nodeType === 'scalar' ? [] : childArr,
        childCount
      }
    }

    return convert(root)
  }

  close(): void {
    try { closeSync(this.fd) } catch {}
  }
}

export interface IndexTreeNode {
  name: string
  path: string
  nodeType: 'object' | 'array' | 'scalar'
  children: IndexTreeNode[]
  childCount: number
}

function tryExtractPath(text: string, parts: string[]): JsonValue | undefined {
  let current: JsonValue | undefined
  try {
    current = JSON.parse(text) as JsonValue
  } catch {
    return undefined
  }
  return tryExtractPathFrom(current, parts)
}

function tryExtractPathFrom(current: JsonValue, parts: string[]): JsonValue | undefined {
  let val = current
  for (const part of parts) {
    if (val === null || val === undefined) return undefined
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      const key = arrayMatch[1]
      const index = parseInt(arrayMatch[2], 10)
      if (typeof val !== 'object' || Array.isArray(val)) return undefined
      const arrVal = (val as Record<string, JsonValue>)[key]
      if (!Array.isArray(arrVal) || index >= arrVal.length) return undefined
      const arr: JsonValue[] = arrVal
      val = arr[index]
    } else if (part.match(/^\[(\d+)\]$/)) {
      const index = parseInt(part.match(/^\[(\d+)\]$/)![1], 10)
      if (!Array.isArray(val)) return undefined
      if (index >= val.length) return undefined
      val = val[index]
    } else {
      if (typeof val !== 'object' || Array.isArray(val)) return undefined
      val = (val as Record<string, JsonValue>)[part]
    }
  }
  return val
}
