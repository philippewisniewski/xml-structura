import sax from 'sax'
import { createReadStream, statSync } from 'fs'
import { stat } from 'fs/promises'
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
  onOpenTag?: (name: string, attrs: Record<string, string>) => void
  onText?: (text: string) => void
  onCloseTag?: (name: string) => void
}

function stripName(name: string): string {
  return name.includes(':') ? name.split(':').pop()! : name
}

export async function parseXml(
  filePath: string,
  options?: ParserOptions
): Promise<ParsedResult> {
  const strip = options?.stripNamespaces ?? false

  const tmpFile = join(tmpdir(), `structura-${Date.now()}.json`)
  const indexEntries: Array<{ path: string; offset: number }> = []
  const writer = new StreamingJsonWriter(tmpFile, (path, offset) => {
    indexEntries.push({ path, offset })
  })

  let totalBytes = 0
  try {
    const { size } = await stat(filePath)
    totalBytes = size
  } catch {
    writer.discard()
    throw new Error('Cannot access file')
  }

  return new Promise((resolve, reject) => {
    let bytesRead = 0

    const saxStream = sax.createStream(false, { trim: true, position: false, xmlns: false })

    saxStream.on('opentag', (node: sax.Tag) => {
      const tagName = strip ? stripName(node.name) : node.name
      const attrs: Record<string, string> = {}
      for (const [attrName, val] of Object.entries(node.attributes)) {
        if (attrName.startsWith('xmlns')) continue
        const finalName = strip ? stripName(attrName) : attrName
        attrs[finalName] = val as string
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
    const readStream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 65536 })
    readStream.on('data', () => {
      bytesRead = readStream.bytesRead
      if (onProgress) onProgress(bytesRead, totalBytes)
    })
    readStream.pipe(saxStream)
  })
}
