import { memo, useState } from 'react'
import type { TreeNode } from '../parser/tree-builder'

interface TreeViewProps {
  tree: TreeNode
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
  const [open, setOpen] = useState(depth < 3)

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
      {node.children.map((child, i) => (
        <TreeNodeComponent key={i} node={child} depth={depth + 1} />
      ))}
    </details>
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
