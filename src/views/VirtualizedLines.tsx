import { useEffect, useRef, useState } from 'react'
import { highlightXmlLine } from './highlightXml'

// Windowed renderer for an in-memory array of XML lines. Only the visible
// slice is mounted, so a 20k-line heavy node stays smooth like the JSON <pre>.
// Lines are colored with the same highlighter XmlView uses.
export function VirtualizedLines({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(400)

  const LINE_HEIGHT = 20
  const OVERSCAN = 25

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    setHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const first = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN)
  const last = Math.min(
    lines.length,
    first + Math.ceil(height / LINE_HEIGHT) + 2 * OVERSCAN
  )
  const slice = lines.slice(first, last)

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="overflow-auto max-h-[70vh] bg-gray-900/40 border border-gray-700/40 rounded"
    >
      <div style={{ height: lines.length * LINE_HEIGHT, position: 'relative' }}>
        <div style={{ position: 'absolute', top: first * LINE_HEIGHT, left: 0, right: 0 }}>
          <pre className="p-3 text-xs leading-[20px] m-0">
            <code>
              {slice.map((line, i) => {
                const num = first + i + 1
                return (
                  <div key={num} style={{ display: 'flex', height: LINE_HEIGHT }}>
                    <span className="text-gray-600 select-none mr-4 text-right shrink-0" style={{ width: '5ch' }}>
                      {num}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: highlightXmlLine(line) }} />
                  </div>
                )
              })}
            </code>
          </pre>
        </div>
      </div>
    </div>
  )
}
