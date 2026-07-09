import { parseStream } from '../parser/sax-stream'
import { createTreeBuilder, type TreeNode } from '../parser/tree-builder'
import { renderTree } from '../views/tree-view'
import { renderVirtualXml } from '../views/xml-view'
import { renderJson } from '../views/json-view'
import { extractGpxMetrics } from '../parser/gpx-extractor'
import type { AppState } from '../app'

export function startParsing(file: File, state: AppState, onUpdate: () => void): void {
  state.status = 'parsing'
  state.progress = 0
  state.file = file
  state.tree = null
  state.error = null
  state.gpxMetrics = null
  onUpdate()

  const builder = createTreeBuilder()

  parseStream(file, {
    onOpenTag: (tag, attrs) => builder.onOpenTag(tag, attrs),
    onText: (text) => builder.onText(text),
    onCloseTag: (tag) => builder.onCloseTag(tag),
    onProgress: (pct) => {
      state.progress = pct
      onUpdate()
    },
    onComplete: () => {
      state.tree = builder.root
      state.status = 'done'
      state.progress = 100

      const metrics = extractGpxMetrics(builder.root)
      if (metrics) state.gpxMetrics = metrics

      renderViews(state)
      onUpdate()
    },
    onError: (err) => {
      state.status = 'error'
      state.error = err.message
      onUpdate()
    }
  })
}

export async function renderViews(state: AppState): Promise<void> {
  if (!state.tree || !state.file) return

  const xmlContainer = document.getElementById('panel-xml-content')
  const outputContainer = document.getElementById('panel-output-content')

  if (!xmlContainer || !outputContainer) return

  await renderVirtualXml(xmlContainer, state.file)

  if (state.view === 'tree') {
    outputContainer.innerHTML = `<div class="p-3 overflow-auto h-full text-xs leading-relaxed space-y-0.5">${renderTree(state.tree)}</div>`
  } else {
    outputContainer.innerHTML = `<pre class="p-3 overflow-auto h-full text-xs leading-relaxed"><code>${escapeHtml(renderJson(state.tree))}</code></pre>`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
