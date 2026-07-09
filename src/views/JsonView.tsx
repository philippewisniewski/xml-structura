import { useMemo } from 'react'
import type { TreeNode } from '../parser/tree-builder'

export function treeToObject(node: TreeNode): unknown {
  if (node.tag === '#root') {
    if (node.children.length === 1) {
      return buildNode(node.children[0])
    }
    return node.children.map(buildNode)
  }
  return buildNode(node)
}

function buildNode(node: TreeNode): unknown {
  const result: Record<string, unknown> = {}

  if (Object.keys(node.attributes).length > 0) {
    result['@attributes'] = node.attributes
  }

  if (node.text && node.children.length === 0) {
    return node.text
  }

  if (node.text && node.children.length > 0) {
    result['#text'] = node.text
  }

  for (const child of node.children) {
    if (result[child.tag]) {
      if (!Array.isArray(result[child.tag])) {
        result[child.tag] = [result[child.tag]]
      }
      (result[child.tag] as unknown[]).push(buildNode(child))
    } else {
      result[child.tag] = buildNode(child)
    }
  }

  if (Object.keys(result).length === 0 && node.text) {
    return node.text
  }

  return result
}

interface JsonViewProps {
  tree: TreeNode
}

export function JsonView({ tree }: JsonViewProps) {
  const json = useMemo(() => {
    const obj = treeToObject(tree)
    return JSON.stringify(obj, null, 2)
  }, [tree])

  return (
    <pre className="p-3 overflow-auto h-full text-xs leading-relaxed">
      <code>{json}</code>
    </pre>
  )
}
