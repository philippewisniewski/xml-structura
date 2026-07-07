import { openSync, writeSync, closeSync, unlinkSync } from 'fs'

interface ChildState {
  count: number
  placeholderPos: number
  arrayClosed: boolean
}

interface Context {
  tagName: string
  textParts: string[]
  path: string
  children: Map<string, ChildState>
  needsComma: boolean
  objectStarted: boolean
}

const ESCAPE_MAP: Record<string, string> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t'
}

function escapeJson(s: string): string {
  return s.replace(/[\\"\n\r\t]/g, c => ESCAPE_MAP[c])
}

export class StreamingJsonWriter {
  private fd: number
  private filePath: string
  pos: number = 0
  private stack: Context[] = []
  private rootOpened: boolean = false
  private onKey: ((keyPath: string, valueStart: number) => void) | null = null
  private writeQueue: string[] = []
  private queuedBytes: number = 0

  constructor(
    tmpPath: string,
    onKey?: (keyPath: string, valueStart: number) => void
  ) {
    this.filePath = tmpPath
    this.fd = openSync(tmpPath, 'w')
    this.onKey = onKey || null
  }

  private flush(): void {
    if (this.queuedBytes === 0) return
    const buf = Buffer.from(this.writeQueue.join(''), 'utf-8')
    this.writeQueue = []
    this.queuedBytes = 0
    writeSync(this.fd, buf, 0, buf.length, this.pos - buf.length)
  }

  private write(s: string): void {
    const byteLen = Buffer.byteLength(s, 'utf-8')
    this.writeQueue.push(s)
    this.queuedBytes += byteLen
    this.pos += byteLen
    if (this.queuedBytes >= 65536) {
      this.flush()
    }
  }

  private writeAt(s: string, position: number): void {
    this.flush()
    const buf = Buffer.from(s, 'utf-8')
    const written = writeSync(this.fd, buf, 0, buf.length, position)
    this.pos = position + written
  }

  openTag(name: string, attrs: Record<string, string>): void {
    if (this.stack.length === 0) {
      this.write('{')
      this.rootOpened = true
      this.write(`"${escapeJson(name)}": `)
      const itemPath = '$.' + name
      if (this.onKey) this.onKey(itemPath, this.pos)
      const ctx: Context = {
        tagName: name,
        textParts: [],
        path: itemPath,
        children: new Map(),
        needsComma: false,
        objectStarted: false
      }
      const attrsEntries = Object.entries(attrs)
      if (attrsEntries.length > 0) {
        this.write('{')
        ctx.objectStarted = true
        let first = true
        for (const [k, v] of attrsEntries) {
          if (!first) this.write(', ')
          this.write(`"${escapeJson(k)}":"${escapeJson(v)}"`)
          if (this.onKey)
            this.onKey(
              itemPath + '.' + k,
              this.pos - Buffer.byteLength(`"${escapeJson(v)}"`, 'utf-8')
            )
          first = false
          ctx.needsComma = true
        }
      }
      this.stack.push(ctx)
      return
    }

    const parent = this.stack[this.stack.length - 1]

    if (!parent.objectStarted) {
      this.write('{')
      parent.objectStarted = true
    }

    for (const [key, info] of parent.children) {
      if (key !== name && info.count > 1 && !info.arrayClosed) {
        this.write(']')
        info.arrayClosed = true
      }
    }

    const childInfo = parent.children.get(name) ?? {
      count: 0,
      placeholderPos: -1,
      arrayClosed: false
    }
    childInfo.count++
    parent.children.set(name, childInfo)

    const itemPath = parent.path + '.' + name

    if (childInfo.count === 1) {
      if (parent.needsComma) this.write(', ')
      parent.needsComma = true
      this.write(`"${escapeJson(name)}":`)
      childInfo.placeholderPos = this.pos
      this.write(' ')
      if (this.onKey) this.onKey(itemPath, this.pos)
    } else if (childInfo.count === 2) {
      this.flush()
      const endPos = this.pos
      this.writeAt('[', childInfo.placeholderPos)
      this.pos = endPos
      this.write(', ')
      if (this.onKey) this.onKey(itemPath + '[]', childInfo.placeholderPos)
    } else {
      this.write(', ')
    }

    const ctx: Context = {
      tagName: name,
      textParts: [],
      path: itemPath,
      children: new Map(),
      needsComma: false,
      objectStarted: false
    }

    const attrsEntries = Object.entries(attrs)
    if (attrsEntries.length > 0) {
      this.write('{')
      ctx.objectStarted = true
      let first = true
      for (const [k, v] of attrsEntries) {
        if (!first) this.write(', ')
        this.write(`"${escapeJson(k)}":"${escapeJson(v)}"`)
        if (this.onKey && childInfo.count < 2) {
          this.onKey(
            itemPath + '.' + k,
            this.pos - Buffer.byteLength(`"${escapeJson(v)}"`, 'utf-8')
          )
        }
        first = false
        ctx.needsComma = true
      }
    }

    this.stack.push(ctx)
  }

  setText(text: string): void {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].textParts.push(text)
    }
  }

  closeTag(name: string): void {
    if (this.stack.length === 0) return

    const ctx = this.stack.pop()!
    const hasChildren = ctx.children.size > 0
    const fullText = ctx.textParts.join('')

    if (fullText) {
      if (ctx.objectStarted || hasChildren) {
        if (ctx.needsComma) this.write(', ')
        this.write(`"#text":"${escapeJson(fullText)}"`)
      } else {
        this.write(`"${escapeJson(fullText)}"`)
      }
    }

    for (const [, info] of ctx.children) {
      if (info.count > 1 && !info.arrayClosed) {
        this.write(']')
        info.arrayClosed = true
      }
    }

    if (ctx.objectStarted) {
      this.write('}')
    } else if (!fullText && !hasChildren) {
      this.write('null')
    }
  }

  close(): void {
    if (this.rootOpened) {
      this.write('}')
    }
    this.flush()
    closeSync(this.fd)
  }

  discard(): void {
    this.flush()
    closeSync(this.fd)
    try {
      unlinkSync(this.filePath)
    } catch {
      // temp file cleanup is best-effort
    }
  }
}
