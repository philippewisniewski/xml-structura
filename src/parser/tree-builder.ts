export type NodeKind = 'element' | 'comment' | 'processinginstruction' | 'cdata'

export interface TreeNode {
  kind: NodeKind
  tag: string
  attributes: Record<string, string>
  children: TreeNode[]
  text?: string
  /** Body of a processing instruction (everything after the target name). */
  instructionBody?: string
}

export function createTreeBuilder() {
  const root: TreeNode = { kind: 'element', tag: '#root', attributes: {}, children: [] }
  const stack: TreeNode[] = [root]
  let currentText = ''

  // CDATA can be emitted across multiple `cdata` events; accumulate until close.
  let cdataBuffer: string | null = null

  return {
    root,

    onOpenTag(tag: string, attrs: Record<string, string>) {
      flushText()
      const node: TreeNode = { kind: 'element', tag, attributes: attrs, children: [] }
      const parent = stack[stack.length - 1]
      parent.children.push(node)
      stack.push(node)
    },

    onText(text: string) {
      currentText += text
    },

    onComment(text: string) {
      flushText()
      const parent = stack[stack.length - 1]
      parent.children.push({ kind: 'comment', tag: '#comment', attributes: {}, children: [], text })
    },

    onProcessingInstruction(name: string, body: string) {
      flushText()
      const parent = stack[stack.length - 1]
      parent.children.push({
        kind: 'processinginstruction',
        tag: '#pi',
        attributes: {},
        children: [],
        text: name,
        instructionBody: body,
      })
    },

    onOpenCData() {
      flushText()
      cdataBuffer = ''
    },

    onCData(text: string) {
      if (cdataBuffer !== null) cdataBuffer += text
    },

    onCloseCData() {
      const data = cdataBuffer ?? ''
      cdataBuffer = null
      const parent = stack[stack.length - 1]
      parent.children.push({ kind: 'cdata', tag: '#cdata', attributes: {}, children: [], text: data })
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
      cdataBuffer = null
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
