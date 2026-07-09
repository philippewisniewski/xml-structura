import { memo, useMemo, useRef, useState } from 'react'
import type { TreeNode } from '../parser/tree-builder'
import { highlightXmlLine } from './highlightXml'

const LINE_HEIGHT = 20
const OVERSCAN = 25

interface Row {
  key: string
  depth: number
  node: TreeNode
  hasChildren: boolean
  collapsed: boolean
}

// Flatten the root children into visible rows. `collapsed` holds positional
// path keys ("parent.i"), so same-tag siblings never share a key (this is the
// exact bug from issue #23, avoided by using index-based paths).
function flatten(roots: TreeNode[], collapsed: Set<string>, out: Row[]): void {
  const walk = (nodes: TreeNode[], parentKey: string, depth: number) => {
    nodes.forEach((node, i) => {
      const key = `${parentKey}.${i}`
      const hasChildren = node.children.length > 0
      const isCollapsed = collapsed.has(key)
      out.push({ key, depth, node, hasChildren, collapsed: isCollapsed })
      if (hasChildren && !isCollapsed) walk(node.children, key, depth + 1)
    })
  }
  walk(roots, 'r', 0)
}

// Build the raw XML for a single row (opening tag; the text/children render as
// later rows when expanded).
function rowXml(depth: number, node: TreeNode): string {
  const pad = '  '.repeat(depth)
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
  const suffix = node.children.length > 0 || node.text == null ? '>' : `>${node.text}</${node.tag}>`
  return `${pad}<${node.tag}${attrs}${suffix}`
}

export function VirtualizedTree({ roots }: { roots: TreeNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(400)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const rows = useMemo(() => {
    const out: Row[] = []
    flatten(roots, collapsed, out)
    return out
  }, [roots, collapsed])

  const allKeys = useMemo(() => {
    const set = new Set<string>()
    const walk = (nodes: TreeNode[], parentKey: string) => {
      nodes.forEach((n, i) => {
        const key = `${parentKey}.${i}`
        set.add(key)
        if (n.children.length > 0) walk(n.children, key)
      })
    }
    walk(roots, 'r')
    return set
  }, [roots])

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const collapseAll = () => setCollapsed(new Set(allKeys))
  const expandAll = () => setCollapsed(new Set())

  const first = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN)
  const last = Math.min(rows.length, first + Math.ceil(height / LINE_HEIGHT) + 2 * OVERSCAN)
  const slice = rows.slice(first, last)

  return (
    <div>
      <div className="flex gap-2 mb-1 text-[11px]">
        <button className="px-2 py-0.5 rounded bg-gray-700/40 hover:bg-gray-700/70" onClick={expandAll}>
          Expand all
        </button>
        <button className="px-2 py-0.5 rounded bg-gray-700/40 hover:bg-gray-700/70" onClick={collapseAll}>
          Collapse all
        </button>
      </div>
      <div
        ref={ref}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="overflow-auto max-h-[70vh] bg-gray-900/40 border border-gray-700/40 rounded"
      >
        <div style={{ height: rows.length * LINE_HEIGHT, position: 'relative' }}>
          <div style={{ position: 'absolute', top: first * LINE_HEIGHT, left: 0, right: 0 }}>
            <pre className="p-3 text-xs leading-[20px] m-0">
              <code>
                {slice.map((row) => (
                  <div
                    key={row.key}
                    style={{ display: 'flex', height: LINE_HEIGHT }}
                    className="hover:bg-gray-700/20"
                  >
                    <span className="text-gray-600 select-none mr-2 shrink-0" style={{ width: '2ch' }}>
                      {row.hasChildren ? (
                        <span
                          className="cursor-pointer"
                          onClick={() => toggle(row.key)}
                        >
                          {row.collapsed ? '▸' : '▾'}
                        </span>
                      ) : (
                        '·'
                      )}
                    </span>
                    <span
                      className="whitespace-pre"
                      dangerouslySetInnerHTML={{ __html: highlightXmlLine(rowXml(row.depth, row.node)) }}
                    />
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(VirtualizedTree)
