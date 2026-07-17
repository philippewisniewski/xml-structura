// Attributes are stored as an ordered list of [name, value] tuples so the
// source attribute order is preserved (a plain Record loses ordering for
// numeric-like keys and encourages re-ordering on render/serialize).
export type Attribute = [string, string]

export interface TreeNode {
  tag: string
  attributes: Attribute[]
  children: TreeNode[]
  text?: string
  // Whitespace-only text between this node and its siblings/parent. Captured
  // only when raw formatting is enabled, so the default view stays clean.
  whitespace?: string
}

export function createTreeBuilder() {
  const root: TreeNode = { tag: '#root', attributes: [], children: [] }
  const stack: TreeNode[] = [root]
  let currentText = ''
  let currentWhitespace = ''

  return {
    root,

    onOpenTag(tag: string, attrs: Attribute[]) {
      flushText()
      flushWhitespace()
      const node: TreeNode = { tag, attributes: attrs, children: [] }
      const parent = stack[stack.length - 1]
      parent.children.push(node)
      stack.push(node)
    },

    onText(text: string) {
      // Whitespace-only fragments are kept separate from meaningful text so
      // they can be rendered (raw mode) or dropped (default mode) independently.
      if (text.trim() === '') {
        currentWhitespace += text
      } else {
        currentText += text
      }
    },

    onCloseTag(tag: string) {
      flushText()
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) {
        stack.pop()
        flushWhitespace()
      }
    },

    reset() {
      root.children = []
      stack.length = 1
      currentText = ''
      currentWhitespace = ''
    }
  }

  function flushText() {
    if (currentText) {
      const parent = stack[stack.length - 1]
      if (parent.children.length === 0) {
        parent.text = currentText
      } else {
        const last = parent.children[parent.children.length - 1]
        last.text = currentText
      }
      currentText = ''
    }
  }

  function flushWhitespace() {
    if (currentWhitespace) {
      const parent = stack[stack.length - 1]
      if (parent.children.length > 0) {
        const last = parent.children[parent.children.length - 1]
        last.whitespace = (last.whitespace ?? '') + currentWhitespace
      } else {
        parent.whitespace = (parent.whitespace ?? '') + currentWhitespace
      }
      currentWhitespace = ''
    }
  }
}
