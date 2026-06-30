import { openSync, writeSync, closeSync } from 'fs'

interface ChildEntry {
  count: number
  placeholderPos: number
  arrayClosed: boolean
}

interface Context {
  tagName: string
  text: string
  children: Map<string, ChildEntry>
  needsComma: boolean
  objectStarted: boolean
}

function escapeJson(s: string): string {
  return s
    .replace(/[\\"]/g, (c) => (c === '\\' ? '\\\\' : '\\"'))
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

export type KeyCallback = (keyPath: string, valueStart: number) => void
export type TagCloseCallback = (keyPath: string, endOffset: number) => void

function makePath(stack: Context[], name?: string): string {
  const parts = stack.map(c => c.tagName)
  if (name) parts.push(name)
  return '$.' + parts.join('.')
}

export class StreamingJsonWriter {
  private fd: number
  pos: number = 0
  private stack: Context[] = []
  private rootOpened: boolean = false
  private onKey: KeyCallback | null = null
  private onTagClose: TagCloseCallback | null = null
  /** Tracks final count for each array path (path without []) */
  private _arrayCounts: Map<string, number> = new Map()

  constructor(tmpPath: string, onKey?: KeyCallback, onTagClose?: TagCloseCallback) {
    this.fd = openSync(tmpPath, 'w')
    this.onKey = onKey || null
    this.onTagClose = onTagClose || null
  }

  openTag(name: string, attrs: Record<string, string>): void {
    if (this.stack.length === 0) {
      this.write('{')
      this.rootOpened = true
      this.write(`"${escapeJson(name)}": `)
      if (this.onKey) this.onKey('$.' + name, this.pos)
      const ctx: Context = {
        tagName: name,
        text: '',
        children: new Map(),
        needsComma: false,
        objectStarted: false
      }
      const rootPath = '$.' + name
      const hasAttrs = Object.keys(attrs).length > 0
      if (hasAttrs) {
        this.write('{')
        ctx.objectStarted = true
        let first = true
        for (const [k, v] of Object.entries(attrs)) {
          if (!first) this.write(', ')
          this.write(`"${escapeJson(k)}":"${escapeJson(v)}"`)
          if (this.onKey) this.onKey(rootPath + '.' + k, this.pos - Buffer.byteLength(`"${escapeJson(v)}"`, 'utf-8'))
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

    const itemPath = makePath(this.stack, name)

    if (childInfo.count >= 2) {
      this._arrayCounts.set(itemPath, childInfo.count)
    }

    if (childInfo.count === 1) {
      if (parent.needsComma) this.write(', ')
      parent.needsComma = true
      this.write(`"${escapeJson(name)}":`)
      childInfo.placeholderPos = this.pos
      this.write(' ')
      if (this.onKey) this.onKey(itemPath, this.pos)
    } else if (childInfo.count === 2) {
      const endPos = this.pos
      this.pos = childInfo.placeholderPos
      this.write('[')
      this.pos = endPos
      this.write(', ')
      if (this.onKey) {
        this.onKey(itemPath + '[]', childInfo.placeholderPos)
      }
    } else {
      this.write(', ')
    }

    const ctx: Context = {
      tagName: name,
      text: '',
      children: new Map(),
      needsComma: false,
      objectStarted: false
    }

    const hasAttrs = Object.keys(attrs).length > 0
    if (hasAttrs) {
      this.write('{')
      ctx.objectStarted = true
      let first = true
      for (const [k, v] of Object.entries(attrs)) {
        if (!first) this.write(', ')
        this.write(`"${escapeJson(k)}":"${escapeJson(v)}"`)
        if (this.onKey && childInfo.count < 2) {
          this.onKey(itemPath + '.' + k, this.pos - Buffer.byteLength(`"${escapeJson(v)}"`, 'utf-8'))
        }
        first = false
        ctx.needsComma = true
      }
    }

    this.stack.push(ctx)
  }

  setText(text: string): void {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].text += text
    }
  }

  closeTag(name: string): void {
    if (this.stack.length === 0) return

    const ctx = this.stack.pop()!
    const hasChildren = ctx.children.size > 0

    if (ctx.text) {
      if (ctx.objectStarted || hasChildren) {
        if (ctx.needsComma) this.write(', ')
        this.write(`"#text":"${escapeJson(ctx.text)}"`)
      } else {
        this.write(`"${escapeJson(ctx.text)}"`)
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
    } else if (!ctx.text && !hasChildren) {
      this.write('{}')
    }

    if (this.onTagClose) {
      const fullPath = makePath(this.stack, ctx.tagName)
      this.onTagClose(fullPath, this.pos)
    }
  }

  private write(s: string): void {
    const buf = Buffer.from(s, 'utf-8')
    const written = writeSync(this.fd, buf, 0, buf.length, this.pos)
    this.pos += written
  }

  appendRaw(s: string): void {
    this.write(s)
  }

  getPos(): number {
    return this.pos
  }

  getArrayCounts(): Map<string, number> {
    return this._arrayCounts
  }

  close(): void {
    if (this.rootOpened) {
      this.write('}')
    }
    closeSync(this.fd)
  }
}
