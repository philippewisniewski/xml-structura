import { memo } from 'react'
import type { TreeNode } from '../parser/tree-builder'

interface TreeViewProps {
  tree: TreeNode
  expandedPaths: Set<string>
  onToggle: (path: string) => void
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
  path: string
  expandedPaths: Set<string>
  onToggle: (path: string) => void
}

const TreeNodeComponent = memo(function TreeNodeComponent({
  node, depth, path, expandedPaths, onToggle
}: TreeNodeProps) {
  const nodePath = `${path}/${node.tag}`
  const hasChildren = node.children.length > 0
  const longText = node.text && node.text.length > 100
  const isOpen = expandedPaths.has(nodePath) || depth < 3

  if (!hasChildren && !longText) {
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
    <details open={isOpen} className="tree-node group">
      <summary
        className="tree-summary cursor-pointer hover:bg-gray-700/30 rounded px-1 -ml-1 select-none"
        onClick={(e) => { e.preventDefault(); onToggle(nodePath) }}
      >
        <span className="text-blue-400">&lt;</span>
        <span className="text-emerald-300">{node.tag}</span>
        {renderAttrs(node.attributes)}
        <span className="text-blue-400">&gt;</span>
        {node.text && node.text.length <= 100 && <span className="text-gray-300">{node.text}</span>}
      </summary>
      {node.text && node.text.length > 100 && (
        <div className="tree-text ml-4 text-gray-300 whitespace-pre-wrap">{node.text}</div>
      )}
      {isOpen && node.children.map((child, i) => (
        <TreeNodeComponent
          key={`${nodePath}-${i}`}
          node={child}
          depth={depth + 1}
          path={nodePath}
          expandedPaths={expandedPaths}
          onToggle={onToggle}
        />
      ))}
    </details>
  )
})

export function TreeView({ tree, expandedPaths, onToggle }: TreeViewProps) {
  return (
    <div className="p-3 overflow-auto h-full text-xs leading-relaxed space-y-0.5">
      {tree.children.map((child, i) => (
        <TreeNodeComponent
          key={`root-${i}`}
          node={child}
          depth={0}
          path="#root"
          expandedPaths={expandedPaths}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
