import { memo, useMemo, useState } from 'react'
import type { TreeNode } from '../parser/tree-builder'

// Above this many children a node is not auto-expanded, so we don't mount
// tens of thousands of DOM nodes (e.g. a <trkseg> with 20k <trkpt>) on load.
const LARGE_CHILD_THRESHOLD = 500

interface TreeViewProps {
  tree: TreeNode
}

// Serialize a node (and its descendants) back to XML so a node with a huge
// child list can be shown as a single `<pre>` (one DOM node) instead of
// instantiating tens of thousands of components, which blocks the main
// thread and janks when the node is expanded.
function serialize(node: TreeNode, indent: number): string {
  const pad = '  '.repeat(indent)
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
  const open = `${pad}<${node.tag}${attrs}>`
  if (node.children.length === 0 && node.text != null) {
    return `${open}${node.text}</${node.tag}>`
  }
  if (node.children.length === 0) {
    return `${open}</${node.tag}>`
  }
  const inner = node.children
    .map((c) => serialize(c, indent + 1))
    .join('')
  return `${open}\n${inner}\n${pad}</${node.tag}>`
}

function renderAttrs(attrs: Record<string, string>) {
  const parts: React.ReactNode[] = []
  for (const [k, v] of Object.entries(attrs)) {
    parts.push(
      <span key={k}>
        {' '}<span className="text-purple-400">{k}</span>=<span className="text-amber-300">&quot;{v}&quot;</span>
      </span>
    )
  }
  return parts
}

interface TreeNodeProps {
  node: TreeNode
  depth: number
}

const TreeNodeComponent = memo(function TreeNodeComponent({
  node, depth
}: TreeNodeProps) {
  // Each node owns its own open state. Toggling one node only re-renders
  // that node's subtree — siblings are untouched, so there is no shared
  // path-key to collide and no global re-render on every toggle.
  // Auto-expand shallow levels, but never a node with a huge child list.
  const [open, setOpen] = useState(depth < 3 && node.children.length <= LARGE_CHILD_THRESHOLD)

  const hasChildren = node.children.length > 0
  const hasLongText = !!node.text && node.text.length > 100
  const isExpandable = hasChildren || hasLongText

  if (!isExpandable) {
    return (
      <div className="tree-leaf ml-4">
        <span className="text-blue-400">&lt;</span>
        <span className="text-emerald-300">{node.tag}</span>
        {renderAttrs(node.attributes)}
        <span className="text-blue-400">&gt;</span>
        {node.text && <span className="text-gray-300">{node.text}</span>}
        <span className="text-blue-400">&lt;/</span>
        <span className="text-emerald-300">{node.tag}</span>
        <span className="text-blue-400">&gt;</span>
      </div>
    )
  }

  return (
    <details
      open={open}
      className="tree-node group"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="tree-summary cursor-pointer hover:bg-gray-700/30 rounded px-1 -ml-1 select-none">
        <span className="text-blue-400">&lt;</span>
        <span className="text-emerald-300">{node.tag}</span>
        {renderAttrs(node.attributes)}
        <span className="text-blue-400">&gt;</span>
        {hasChildren && (
          <span className="ml-1 text-[10px] text-gray-500">
            {node.children.length}
          </span>
        )}
        {node.text && node.text.length <= 100 && (
          <span className="text-gray-300">{node.text}</span>
        )}
      </summary>
      {node.text && node.text.length > 100 && (
        <div className="tree-text ml-4 text-gray-300 whitespace-pre-wrap">{node.text}</div>
      )}
      {open && (
        node.children.length > LARGE_CHILD_THRESHOLD ? (
          <HeavyChildList node={node} />
        ) : (
          node.children.map((child, i) => (
            <TreeNodeComponent key={i} node={child} depth={depth + 1} />
          ))
        )
      )}
    </details>
  )
})

// A node with a very large child list (e.g. <trkseg> with 20k <trkpt>) is
// shown as a single serialized `<pre>` so expanding it costs one DOM node
// instead of tens of thousands of components that block the main thread.
// Memoized so the (potentially large) string is only built once.
const HeavyChildList = memo(function HeavyChildList({ node }: { node: TreeNode }) {
  const text = useMemo(
    () => node.children.map((child) => serialize(child, 1)).join('\n'),
    [node]
  )
  return (
    <pre className="ml-4 mt-1 text-gray-300 whitespace-pre text-[11px] leading-relaxed max-h-[70vh] overflow-auto">
      {text}
    </pre>
  )
})

export function TreeView({ tree }: TreeViewProps) {
  return (
    <div className="p-3 overflow-auto h-full text-xs leading-relaxed space-y-0.5">
      {tree.children.map((child, i) => (
        <TreeNodeComponent key={`root-${i}`} node={child} depth={0} />
      ))}
    </div>
  )
}
