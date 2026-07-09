import sax from 'sax'

export interface SaxCallbacks {
  onOpenTag: (tag: string, attrs: Record<string, string>) => void
  onText: (text: string) => void
  onCloseTag: (tag: string) => void
  onProgress: (pct: number) => void
  onComplete: () => void
  onError: (err: Error) => void
}

const CHUNK_SIZE = 1024 * 1024

export function parseStream(
  file: File,
  callbacks: SaxCallbacks
): void {
  const parser = sax.parser(true, { trim: true, normalize: true })

  parser.onopentag = (node: sax.Tag) => {
    const attrs: Record<string, string> = {}
    for (const [k, v] of Object.entries(node.attributes)) {
      attrs[k] = String(v)
    }
    callbacks.onOpenTag(node.name, attrs)
  }

  parser.ontext = (text: string) => {
    const t = text.trim()
    if (t) callbacks.onText(t)
  }

  parser.onclosetag = (tag: string) => {
    callbacks.onCloseTag(tag)
  }

  parser.onend = () => {
    callbacks.onComplete()
  }

  parser.onerror = (err: Error) => {
    callbacks.onError(err)
  }

  let offset = 0
  const total = file.size

  function readNext(): void {
    if (offset >= total) {
      parser.close()
      return
    }
    const slice = file.slice(offset, offset + CHUNK_SIZE)
    const reader = new FileReader()

    reader.onload = () => {
      const text = reader.result as string
      parser.write(text)
      offset += text.length
      const pct = Math.round((offset / total) * 100)
      callbacks.onProgress(pct)
      setTimeout(readNext, 0)
    }

    reader.onerror = () => {
      callbacks.onError(new Error('FileReader error'))
    }

    reader.readAsText(slice)
  }

  readNext()
}

export function readEntireFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
