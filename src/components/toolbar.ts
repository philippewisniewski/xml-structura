import type { ViewMode, Theme } from '../app'

let initialized = false

export function initToolbar(): void {
  if (initialized) return
  initialized = true

  const el = document.getElementById('toolbar')!
  el.innerHTML = `
    <div class="flex items-center gap-2 px-3 py-1.5">
      <button id="btn-sidebar" class="p-1 rounded hover:bg-gray-700 transition-colors" title="Toggle sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="2" y1="3" x2="14" y2="3"></line>
          <line x1="2" y1="8" x2="14" y2="8"></line>
          <line x1="2" y1="13" x2="14" y2="13"></line>
        </svg>
      </button>
      <button id="btn-open" class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium transition-colors">
        Open File
      </button>
      <input id="file-input" type="file" accept=".xml,.gpx,.svg,.rss,.atom,.xhtml" class="hidden" />

      <div class="h-4 w-px bg-gray-600"></div>

      <button id="btn-tree" class="px-2 py-1 rounded text-xs font-medium transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700">Tree</button>
      <button id="btn-json" class="px-2 py-1 rounded text-xs font-medium transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700">Raw</button>

      <div class="flex-1"></div>

      <span id="file-name" class="text-xs text-gray-500 truncate max-w-48"></span>

      <button id="btn-copy" class="px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 text-xs transition-colors">Copy</button>
      <button id="btn-dl" class="px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 text-xs transition-colors">DL JSON</button>

      <div class="h-4 w-px bg-gray-600"></div>

      <button id="btn-theme" class="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">☀</button>
    </div>
  `
}

export function updateToolbar(view: ViewMode, theme: Theme, fileName: string, hasResult: boolean): void {
  const treeBtn = document.getElementById('btn-tree')
  const jsonBtn = document.getElementById('btn-json')
  const themeBtn = document.getElementById('btn-theme')
  const fileNameEl = document.getElementById('file-name')
  const copyBtn = document.getElementById('btn-copy')
  const dlBtn = document.getElementById('btn-dl')

  if (treeBtn) {
    treeBtn.className = `px-2 py-1 rounded text-xs font-medium transition-colors ${
      view === 'tree' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`
  }
  if (jsonBtn) {
    jsonBtn.className = `px-2 py-1 rounded text-xs font-medium transition-colors ${
      view === 'json' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`
  }
  if (themeBtn) themeBtn.textContent = theme === 'dark' ? '☀' : '☾'
  if (fileNameEl) fileNameEl.textContent = fileName
  if (copyBtn) {
    copyBtn.className = `px-2 py-1 rounded text-xs transition-colors ${
      hasResult ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-800 text-gray-600 opacity-30 pointer-events-none'
    }`
  }
  if (dlBtn) {
    dlBtn.className = `px-2 py-1 rounded text-xs transition-colors ${
      hasResult ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-800 text-gray-600 opacity-30 pointer-events-none'
    }`
  }
}

export function attachToolbarHandlers(handlers: {
  onOpenFile: () => void
  onViewChange: (view: ViewMode) => void
  onCopy: () => void
  onDownload: () => void
  onThemeToggle: () => void
  onSidebarToggle: () => void
}): void {
  document.getElementById('btn-sidebar')?.addEventListener('click', handlers.onSidebarToggle)
  document.getElementById('btn-open')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click()
  })

  document.getElementById('btn-tree')?.addEventListener('click', () => handlers.onViewChange('tree'))
  document.getElementById('btn-json')?.addEventListener('click', () => handlers.onViewChange('json'))
  document.getElementById('btn-copy')?.addEventListener('click', handlers.onCopy)
  document.getElementById('btn-dl')?.addEventListener('click', handlers.onDownload)
  document.getElementById('btn-theme')?.addEventListener('click', handlers.onThemeToggle)
}
