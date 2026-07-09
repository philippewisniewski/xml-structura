export interface TreeNode {
  tag: string
  attributes: Record<string, string>
  children: TreeNode[]
  text?: string
}

export function createTreeBuilder() {
  const root: TreeNode = { tag: '#root', attributes: {}, children: [] }
  const stack: TreeNode[] = [root]
  let currentText = ''

  return {
    root,

    onOpenTag(tag: string, attrs: Record<string, string>) {
      flushText()
      const node: TreeNode = { tag, attributes: attrs, children: [] }
      const parent = stack[stack.length - 1]
      parent.children.push(node)
      stack.push(node)
    },

    onText(text: string) {
      currentText += text
    },

    onCloseTag(tag: string) {
      flushText()
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) {
        stack.pop()
      }
    },

    reset() {
      root.children = []
      stack.length = 1
      currentText = ''
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
}
