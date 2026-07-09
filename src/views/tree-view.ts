import type { TreeNode } from '../parser/tree-builder'

export function renderTree(node: TreeNode, depth = 0): string {
  let html = ''

  for (const child of node.children) {
    const hasChildren = child.children.length > 0 || (child.text !== undefined && child.text.length > 100)
    const indent = '  '.repeat(depth)

    if (hasChildren) {
      html += `${indent}<details class="tree-node group" open>\n`
      html += `${indent}  <summary class="tree-summary cursor-pointer hover:bg-gray-700/30 rounded px-1 -ml-1 select-none">`
      html += `<span class="text-blue-400">&lt;</span><span class="text-emerald-300">${escapeHtml(child.tag)}</span>`
      html += renderAttrs(child.attributes)
      html += `<span class="text-blue-400">&gt;</span>`
      if (child.text && child.text.length <= 100) {
        html += `<span class="text-gray-300">${escapeHtml(child.text)}</span>`
      }
      html += `</summary>\n`
      if (child.text && child.text.length > 100) {
        html += `${indent}  <div class="tree-text ml-4 text-gray-300 whitespace-pre-wrap">${escapeHtml(child.text)}</div>\n`
      }
      html += renderTree(child, depth + 2)
      html += `${indent}</details>\n`
    } else {
      html += `${indent}<div class="tree-leaf ml-4">`
      html += `<span class="text-blue-400">&lt;</span><span class="text-emerald-300">${escapeHtml(child.tag)}</span>`
      html += renderAttrs(child.attributes)
      html += `<span class="text-blue-400">&gt;</span>`
      if (child.text) {
        html += `<span class="text-gray-300">${escapeHtml(child.text)}</span>`
      }
      html += `<span class="text-blue-400">&lt;/</span><span class="text-emerald-300">${escapeHtml(child.tag)}</span><span class="text-blue-400">&gt;</span>`
      html += `</div>\n`
    }
  }

  return html
}

function renderAttrs(attrs: Record<string, string>): string {
  let html = ''
  for (const [k, v] of Object.entries(attrs)) {
    html += ` <span class="text-purple-400">${escapeHtml(k)}</span>=<span class="text-amber-300">"${escapeHtml(v)}"</span>`
  }
  return html
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
