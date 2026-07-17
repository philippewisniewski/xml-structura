import { VirtualizedTree } from './VirtualizedTree'
import type { TreeNode } from '../parser/tree-builder'

interface TreeViewProps {
  tree: TreeNode
  preserveRaw?: boolean
}

// The whole document is rendered as one virtualized, collapsible, colored tree
// (see VirtualizedTree). It scales to any file size — only visible rows mount —
// so there is no size threshold and no separate "heavy node" code path.
export function TreeView({ tree, preserveRaw = false }: TreeViewProps) {
  return (
    <div className="h-full overflow-hidden">
      <VirtualizedTree roots={tree.children} preserveRaw={preserveRaw} />
    </div>
  )
}
