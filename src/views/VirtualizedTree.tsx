import { memo, useMemo, useRef, useState } from 'react'
import type { TreeNode } from '../parser/tree-builder'
import { highlightXmlLine } from './highlightXml'
import { GutterRow, GutterNumbers } from '../components/LineGutter'

const LINE_HEIGHT = 20
const OVERSCAN = 25

export interface Row {
  key: string
  depth: number
  node: TreeNode
  hasChildren: boolean
  collapsed: boolean
  type: 'open' | 'close'
}

// Flatten the root children into visible rows. `collapsed` holds positional
// path keys ("parent.i"), so same-tag siblings never share a key (this is the
// exact bug from issue #23, avoided by using index-based paths).
// For every expanded container node we also emit a closing </tag> row right
// after its children, so the view mirrors the literal input XML structure.
function flatten(roots: TreeNode[], collapsed: Set<string>, out: Row[]): void {
  const walk = (nodes: TreeNode[], parentKey: string, depth: number) => {
    nodes.forEach((node, i) => {
      const key = `${parentKey}.${i}`
      const hasChildren = node.children.length > 0
      const isCollapsed = collapsed.has(key)
      out.push({ key, depth, node, hasChildren, collapsed: isCollapsed, type: 'open' })
      if (hasChildren) {
        if (!isCollapsed) {
          walk(node.children, key, depth + 1)
          out.push({ key: `${key}#close`, depth, node, hasChildren: false, collapsed: false, type: 'close' })
        }
      }
    })
  }
  walk(roots, 'r', 0)
}

// Build the raw XML for an opening row. Leaf/text nodes carry their own closing
// text on the same line; container nodes open with '>' and get a separate
// closing row (see rowClose) once their children are listed.
function rowXml(depth: number, node: TreeNode): string {
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
  let suffix: string
  if (node.children.length > 0) suffix = '>'
  else if (node.text != null) suffix = `>${node.text}</${node.tag}>`
  else suffix = `></${node.tag}>`
  return `<${node.tag}${attrs}${suffix}`
}

function rowClose(depth: number, node: TreeNode): string {
  return `</${node.tag}>`
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

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const first = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN)
  const last = Math.min(rows.length, first + Math.ceil(height / LINE_HEIGHT) + 2 * OVERSCAN)
  const slice = rows.slice(first, last)

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="h-full overflow-auto bg-gray-900/40 border border-gray-700/40 rounded"
    >
      <div style={{ height: rows.length * LINE_HEIGHT, position: 'relative' }}>
        <div style={{ position: 'absolute', top: first * LINE_HEIGHT, left: 0, right: 0 }}>
          <div className="flex">
            <GutterNumbers slice={slice} first={first} />
            <pre className="text-xs leading-[20px] m-0 flex-1 pl-1">
              <code>
                {slice.map((row, i) => (
                  <div
                    key={row.key}
                    style={{ display: 'flex', height: LINE_HEIGHT }}
                    className="hover:bg-gray-700/20"
                  >
                    <GutterRow row={row} lineNumber={first + i + 1} onToggle={toggle} />
                    <span
                      className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: highlightXmlLine(
                          row.type === 'close' ? rowClose(row.depth, row.node) : rowXml(row.depth, row.node)
                        )
                      }}
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
