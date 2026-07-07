import sax from 'sax'
import { createReadStream, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { StreamingJsonWriter } from './streaming-json-writer'

export interface ParsedResult {
  filePath: string
  name: string
  size: number
  index: Map<string, number>
}

export interface ParserOptions {
  stripNamespaces?: boolean
  onProgress?: (bytesRead: number, totalBytes: number) => void
  onChunk?: (chunk: string) => void
  onOpenTag?: (name: string, attrs: Record<string, string>) => void
  onText?: (text: string) => void
  onCloseTag?: (name: string) => void
}

function stripName(name: string): string {
  return name.includes(':') ? name.split(':').pop()! : name
}

export function parseXml(
  filePath: string,
  options?: ParserOptions
): Promise<ParsedResult> {
  const strip = options?.stripNamespaces ?? false

  const tmpFile = join(tmpdir(), `structura-${Date.now()}.json`)
  const indexEntries: Array<{ path: string; offset: number }> = []
  const writer = new StreamingJsonWriter(tmpFile, (path, offset) => {
    indexEntries.push({ path, offset })
  })

  return new Promise((resolve, reject) => {
    let totalBytes = 0
    let bytesRead = 0

    try {
      totalBytes = statSync(filePath).size
    } catch {
      writer.discard()
      reject(new Error('Cannot access file'))
      return
    }

    const saxStream = sax.createStream(true, { xmlns: true, trim: true })

    saxStream.on('opentag', (node: sax.Tag | sax.QualifiedTag) => {
      const qualified = node as sax.QualifiedTag
      const tagName = strip && qualified.local ? qualified.local : node.name

      const attrs: Record<string, string> = {}
      if (qualified.attributes) {
        for (const attr of Object.values(qualified.attributes)) {
          if (attr.name.startsWith('xmlns')) continue
          const attrName = strip && attr.local ? attr.local : attr.name
          attrs[attrName] = attr.value
        }
      }

      options?.onOpenTag?.(tagName, attrs)
      writer.openTag(tagName, attrs)
    })

    saxStream.on('text', (text: string) => {
      options?.onText?.(text)
      writer.setText(text)
    })

    saxStream.on('closetag', (qualifiedName: string) => {
      const tagName = strip ? stripName(qualifiedName) : qualifiedName

      writer.closeTag(tagName)
      options?.onCloseTag?.(tagName)
    })

    saxStream.on('error', (err: Error) => {
      writer.discard()
      reject(err)
    })

    saxStream.on('end', () => {
      writer.close()

      const index = new Map<string, number>()
      for (const { path, offset } of indexEntries) {
        index.set(path, offset)
      }

      const name = filePath.split('/').pop() || 'output'
      const size = statSync(tmpFile).size

      resolve({ filePath: tmpFile, name, size, index })
    })

    const onProgress = options?.onProgress
    const onChunk = options?.onChunk
    const readStream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 65536 })
    readStream.on('data', (chunk: string) => {
      bytesRead += Buffer.byteLength(chunk, 'utf-8')
      if (onProgress) onProgress(bytesRead, totalBytes)
      if (onChunk) onChunk(chunk)
    })
    readStream.pipe(saxStream)
  })
}
