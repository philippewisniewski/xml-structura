import { useRef, useEffect, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useApp } from '../App'
import { tokenizeJson, renderTokens } from '../utils/tokenize'

const CHUNK_SIZE = 1024 * 1024

function Line({ index, text }: { index: number; text: string }) {
  const tokens = tokenizeJson(text)
  return (
    <div className='flex whitespace-pre font-mono text-xs leading-5 hover:bg-[var(--accent)]/30'>
      <span className='w-[4ch] shrink-0 text-right text-muted-foreground select-none pr-3'>
        {index}
      </span>
      <span className='flex-1' dangerouslySetInnerHTML={{ __html: renderTokens(tokens) }} />
    </div>
  )
}

function SmallRawView() {
  const { jsonContent } = useApp()
  const formatted = jsonContent ? JSON.stringify(JSON.parse(jsonContent), null, 2) : ''
  const lines = formatted ? formatted.split('\n') : []

  return (
    <div className='min-h-0 flex-1 overflow-auto p-2'>
      {lines.map((line, i) => (
        <Line key={i} index={i + 1} text={line} />
      ))}
    </div>
  )
}

interface FormatState {
  indent: number
  inString: boolean
  escaped: boolean
}

function createFormatter() {
  let state: FormatState = { indent: 0, inString: false, escaped: false }

  return function format(chunk: string): string {
    let result = ''
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i]

      if (state.escaped) {
        result += c
        state.escaped = false
        continue
      }

      if (c === '\\' && state.inString) {
        result += c
        state.escaped = true
        continue
      }

      if (c === '"') {
        result += c
        state.inString = !state.inString
        continue
      }

      if (state.inString) {
        result += c
        continue
      }

      if (c === '{' || c === '[') {
        result += c
        state.indent++
        result += '\n' + '  '.repeat(state.indent)
        continue
      }

      if (c === '}' || c === ']') {
        state.indent--
        result += '\n' + '  '.repeat(state.indent) + c
        continue
      }

      if (c === ',') {
        result += ',\n' + '  '.repeat(state.indent)
        continue
      }

      if (c === ':') {
        result += ': '
        continue
      }

      if (c === ' ' || c === '\n' || c === '\t' || c === '\r') {
        continue
      }

      result += c
    }
    return result
  }
}

function LargeRawView() {
  const { jsonSummary } = useApp()
  const parentRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<string[]>([])
  const [allLoaded, setAllLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const formatterRef = useRef<ReturnType<typeof createFormatter> | null>(null)
  const bytesLoadedRef = useRef(0)
  const loadingRef = useRef(false)
  const loadVersionRef = useRef(0)

  if (!formatterRef.current) {
    formatterRef.current = createFormatter()
  }

  const total = jsonSummary?.fileSize ?? 0

  useEffect(() => {
    if (!jsonSummary) return
    setLines([])
    setAllLoaded(false)
    setLoading(false)
    bytesLoadedRef.current = 0
    loadingRef.current = false
    loadVersionRef.current++
    formatterRef.current = createFormatter()
  }, [jsonSummary])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || allLoaded || !jsonSummary) return
    loadingRef.current = true
    setLoading(true)
    const version = loadVersionRef.current
    try {
      const start = bytesLoadedRef.current
      const raw = await window.api.readJsonChunk(start, CHUNK_SIZE)
      if (version !== loadVersionRef.current) {
        loadingRef.current = false
        setLoading(false)
        return
      }
      if (raw === null || raw.length === 0) {
        setAllLoaded(true)
        loadingRef.current = false
        setLoading(false)
        return
      }
      bytesLoadedRef.current += raw.length
      const formatted = formatterRef.current!(raw)
      const newLines = formatted.split('\n')
      setLines(prev => [...prev, ...newLines])
      if (raw.length < CHUNK_SIZE) {
        setAllLoaded(true)
      }
    } catch {
      // chunk read failed silently
    }
    loadingRef.current = false
    setLoading(false)
  }, [allLoaded, jsonSummary])

  useEffect(() => {
    loadMore()
  }, [jsonSummary])

  const virtualizer = useVirtualizer({
    count: lines.length + (allLoaded ? 0 : 1),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()

  useEffect(() => {
    if (virtualItems.length === 0) return
    const lastItem = virtualItems[virtualItems.length - 1]
    if (lastItem.index >= lines.length - 5 && !allLoaded && !loadingRef.current) {
      loadMore()
    }
  }, [virtualItems, lines.length, allLoaded, loadMore])

  return (
    <div
      ref={parentRef}
      className='h-full overflow-auto font-mono text-xs'
      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {virtualItems.map(virtualItem => {
          const isLoader = virtualItem.index >= lines.length
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {isLoader ? (
                <div className='flex items-center px-3 py-0.5 text-muted-foreground select-none'>
                  Loading... ({(bytesLoadedRef.current / 1024).toFixed(0)}KB / {(total / 1024).toFixed(0)}KB)
                </div>
              ) : (
                <Line
                  index={virtualItem.index + 1}
                  text={lines[virtualItem.index]}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RawJsonPreview() {
  const { jsonContent, isLargeFile } = useApp()

  if (isLargeFile) {
    return <LargeRawView />
  }

  if (jsonContent === null) {
    return <div className='min-h-0 flex-1 overflow-hidden' />
  }

  return <SmallRawView />
}
