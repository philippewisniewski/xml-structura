import { useRef, useState, useEffect, useCallback, memo } from 'react'

const CHUNK_SIZE = 0x100000
const AVG_CHARS_PER_LINE = 80
const LINE_HEIGHT = 20
const OVERSCAN = 25

function highlightXmlLine(line: string): string {
  let h = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  h = h.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-gray-600 italic">$1</span>')
  h = h.replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="text-emerald-300">$2</span>')
  h = h.replace(/( [\w:-]+)(=)(&quot;.*?&quot;)/g, '<span class="text-purple-400">$1</span>$2<span class="text-amber-300">$3</span>')
  return h
}

function readSlice(file: File, start: number, end: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file.slice(start, end))
  })
}

interface XmlViewProps {
  file: File | null
}

export const XmlView = memo(function XmlView({ file }: XmlViewProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const cacheRef = useRef({
    totalSize: 0,
    totalChunks: 0,
    chunkLines: new Map<number, string[]>(),
    knownCounts: new Map<number, number>(),
    cumCache: [] as number[],
  })
  const [lines, setLines] = useState<Array<{ num: number; html: string }>>([])
  const [totalHeight, setTotalHeight] = useState(0)

  const cnt = useCallback((ci: number): number => {
    const cache = cacheRef.current
    const k = cache.knownCounts.get(ci)
    if (k !== undefined) return k
    const sz = Math.min(CHUNK_SIZE, cache.totalSize - ci * CHUNK_SIZE)
    return Math.max(1, Math.ceil(sz / AVG_CHARS_PER_LINE))
  }, [])

  const cum = useCallback((ci: number): number => {
    const cache = cacheRef.current
    while (cache.cumCache.length <= ci) {
      const i = cache.cumCache.length
      cache.cumCache.push(i === 0 ? 0 : cache.cumCache[i - 1] + cnt(i - 1))
    }
    return cache.cumCache[ci]
  }, [cnt])

  const totalLinesEstimate = useCallback((): number => {
    const cache = cacheRef.current
    let t = 0
    for (let i = 0; i < cache.totalChunks; i++) t += cnt(i)
    return t
  }, [cnt])

  const findLine = useCallback((lineIdx: number): { ci: number; li: number } => {
    const cache = cacheRef.current
    let acc = 0
    for (let i = 0; i < cache.totalChunks; i++) {
      const c = cnt(i)
      if (acc + c > lineIdx) return { ci: i, li: lineIdx - acc }
      acc += c
    }
    const last = cache.totalChunks - 1
    return { ci: last, li: Math.max(0, cnt(last) - 1) }
  }, [cnt])

  const loadChunk = useCallback(async (ci: number): Promise<string[]> => {
    const cache = cacheRef.current
    if (ci < 0 || ci >= cache.totalChunks) throw new Error(`bad chunk ${ci}`)
    const cached = cache.chunkLines.get(ci)
    if (cached) return cached
    if (!file) return []

    const start = ci * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, cache.totalSize)
    const text = await readSlice(file, start, end)
    const chunkLines = text.split('\n')
    if (end === cache.totalSize && text.endsWith('\n') && chunkLines.length > 0) chunkLines.pop()

    cache.chunkLines.set(ci, chunkLines)
    cache.knownCounts.set(ci, chunkLines.length)
    if (cache.cumCache.length > ci) cache.cumCache.length = ci

    if (cache.chunkLines.size > 25) {
      const keys = [...cache.chunkLines.keys()].sort((a, b) => a - b)
      for (const k of keys.slice(0, keys.length - 25)) cache.chunkLines.delete(k)
    }

    return chunkLines
  }, [file])

  const renderVisible = useCallback(async (scrollTop: number) => {
    const cache = cacheRef.current
    if (!file || cache.totalChunks === 0) return

    const ch = Math.max(scrollerRef.current?.clientHeight ?? 100, 100)
    const firstLine = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN)
    const visibleCount = Math.ceil(ch / LINE_HEIGHT) + 2 * OVERSCAN
    const lastLine = firstLine + visibleCount

    let startCi = 0
    let startLi = 0
    const est = findLine(firstLine)
    const raw = await loadChunk(est.ci)
    const actualCum = cum(est.ci)
    if (firstLine >= actualCum && firstLine < actualCum + raw.length) {
      startCi = est.ci
      startLi = firstLine - actualCum
    } else if (firstLine < actualCum) {
      let ci = est.ci - 1
      while (ci >= 0) {
        const c = await loadChunk(ci)
        const cb = cum(ci)
        if (firstLine >= cb && firstLine < cb + c.length) {
          startCi = ci
          startLi = firstLine - cb
          break
        }
        ci--
      }
    } else {
      let ci = est.ci + 1
      while (ci < cache.totalChunks) {
        const c = await loadChunk(ci)
        const cb = cum(ci)
        if (firstLine >= cb && firstLine < cb + c.length) {
          startCi = ci
          startLi = firstLine - cb
          break
        }
        ci++
      }
    }

    const result: Array<{ num: number; html: string }> = []
    let lineNum = firstLine
    let ci = startCi
    let li = startLi

    while (ci < cache.totalChunks && lineNum <= lastLine) {
      const chunkLines = await loadChunk(ci)
      while (li < chunkLines.length && lineNum <= lastLine) {
        result.push({ num: lineNum + 1, html: highlightXmlLine(chunkLines[li]) })
        lineNum++
        li++
      }
      li = 0
      ci++
    }

    setLines(result)
  }, [file, findLine, loadChunk, cum])

  useEffect(() => {
    if (!file) {
      setLines([])
      setTotalHeight(0)
      return
    }

    const cache = cacheRef.current
    cache.totalSize = file.size
    cache.totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    cache.chunkLines.clear()
    cache.knownCounts.clear()
    cache.cumCache = []

    setTotalHeight(totalLinesEstimate() * LINE_HEIGHT)

    renderVisible(0)

    const scroller = scrollerRef.current
    if (!scroller) return

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        renderVisible(scroller.scrollTop)
      })
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [file, renderVisible, totalLinesEstimate])

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center border-r border-gray-700/30 text-gray-600 text-xs">
        Drop an XML file or click Open
      </div>
    )
  }

  return (
    <div ref={scrollerRef} className="flex-1 min-w-0 h-full overflow-auto border-r border-gray-700/30">
      <div style={{ height: totalHeight, position: 'relative' }}>
        <pre className="p-3 text-xs leading-relaxed m-0">
          <code>
            {lines.map(line => (
              <div key={line.num} style={{ display: 'flex', height: LINE_HEIGHT }}>
                <span className="text-gray-600 select-none mr-4 text-right shrink-0" style={{ width: '4ch' }}>{line.num}</span>
                <span dangerouslySetInnerHTML={{ __html: line.html }} />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
})
