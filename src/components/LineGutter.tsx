import type { Row } from '../views/VirtualizedTree'

const INDENT_WIDTH = '1ch'

// One left-cell of the tree: a vertical indent guide per depth level, the
// collapse toggle (▸/▾) for container nodes, and the line number is rendered by
// the sibling <GutterNumbers> column so the two stay scroll-synced.
export function GutterRow({
  row,
  lineNumber,
  onToggle,
}: {
  row: Row
  lineNumber: number
  onToggle: (key: string) => void
}) {
  return (
    <>
      {Array.from({ length: row.depth }).map((_, d) => (
        <span
          key={d}
          className="select-none shrink-0 text-gray-700/50"
          style={{ width: INDENT_WIDTH, borderLeft: '1px solid currentColor', marginLeft: 2 }}
        >
          {' '}
        </span>
      ))}
      <span className="text-gray-600 select-none mr-1 shrink-0" style={{ width: '1.5ch' }}>
        {row.type === 'open' && row.hasChildren ? (
          <span className="cursor-pointer" onClick={() => onToggle(row.key)}>
            {row.collapsed ? '▸' : '▾'}
          </span>
        ) : (
          '·'
        )}
      </span>
    </>
  )
}

// Fixed-width line-number column. Rendered once per slice (outside the row
// loop) so it scrolls in lock-step with the tree content. Each number cell
// takes the same measured height as its tree row so wrapped lines stay aligned.
export function GutterNumbers({
  slice,
  first,
  heights,
}: {
  slice: Row[]
  first: number
  heights: Map<string, number>
}) {
  return (
    <div
      className="shrink-0 select-none border-r border-gray-700/40 bg-gray-900/40 text-[10px] text-gray-500 text-right"
      style={{ width: 36 }}
    >
      {slice.map((row, i) => (
        <div
          key={row.key}
          style={{ height: heights.get(row.key) ?? 20, lineHeight: '20px' }}
        >
          {first + i + 1}
        </div>
      ))}
    </div>
  )
}
