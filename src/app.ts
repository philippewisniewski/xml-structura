import { initToolbar, updateToolbar, attachToolbarHandlers } from './components/toolbar'
import { renderSidebar, attachSidebar } from './components/sidebar'
import { renderStatusBar } from './components/status-bar'
import { setupDropZone } from './components/drop-zone'
import { setupPanelResize } from './components/panel'
import { startParsing, renderViews } from './hooks/use-parser'
import { loadRecentFiles, saveRecentFile, storeFileHandle, getFileHandle, type RecentFile } from './hooks/use-recent-files'
import { renderJson } from './views/json-view'
import type { TreeNode } from './parser/tree-builder'
import type { GpxMetrics } from './parser/gpx-extractor'

export type ViewMode = 'tree' | 'json'
export type Theme = 'dark' | 'light'
export type Status = 'idle' | 'parsing' | 'done' | 'error'

export interface AppState {
  file: File | null
  tree: TreeNode | null
  status: Status
  error: string | null
  progress: number
  view: ViewMode
  theme: Theme
  sidebarOpen: boolean
  recentFiles: RecentFile[]
  gpxMetrics: GpxMetrics | null
}

export function createApp(): void {
  const state: AppState = {
    file: null,
    tree: null,
    status: 'idle',
    error: null,
    progress: 0,
    view: 'tree',
    theme: (localStorage.getItem('xml-structura-theme') as Theme) || 'dark',
    sidebarOpen: true,
    recentFiles: loadRecentFiles(),
    gpxMetrics: null
  }

  applyTheme(state.theme)
  initToolbar()
  setupPanelResize()
  setupDropZone((file: File) => handleFile(file))

  const FILE_EXT_RE = /\.(xml|gpx|svg|rss|atom|xhtml)$/i

  function handleFile(file: File): void {
    if (!file.name.match(FILE_EXT_RE)) return
    saveRecentFile({ name: file.name, lastOpened: Date.now() })
    state.recentFiles = loadRecentFiles()
    startParsing(file, state, updateUI)
  }

  document.getElementById('file-input')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement
    if (input.files?.[0]) handleFile(input.files[0])
    input.value = ''
  })

  attachToolbarHandlers({
    onOpenFile: () => {
      if ('showOpenFilePicker' in window) {
        ;(window as any).showOpenFilePicker({
          types: [{
            description: 'XML Files',
            accept: { 'text/xml': ['.xml', '.gpx', '.svg', '.rss', '.atom', '.xhtml'] }
          }],
          multiple: false
        }).then(async ([handle]: [FileSystemFileHandle]) => {
          const file = await handle.getFile()
          if (file.name.match(FILE_EXT_RE)) {
            storeFileHandle(file.name, handle)
            handleFile(file)
          }
        }).catch(() => {})
      } else {
        document.getElementById('file-input')?.click()
      }
    },
    onViewChange: (view: ViewMode) => {
      state.view = view
      if (state.tree && state.file) renderViews(state)
      updateUI()
    },
    onCopy: () => {
      if (!state.tree) return
      navigator.clipboard.writeText(renderJson(state.tree)).catch(() => {})
    },
    onDownload: () => {
      if (!state.tree || !state.file) return
      const json = renderJson(state.tree)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = state.file.name.replace(FILE_EXT_RE, '') + '.json'
      a.click()
      URL.revokeObjectURL(url)
    },
    onThemeToggle: () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('xml-structura-theme', state.theme)
      applyTheme(state.theme)
      updateUI()
    },
    onSidebarToggle: () => {
      state.sidebarOpen = !state.sidebarOpen
      updateUI()
    }
  })

  function updateUI(): void {
    updateToolbar(state.view, state.theme, state.file?.name ?? '', state.status === 'done')

    const sidebarEl = document.getElementById('sidebar')!
    sidebarEl.classList.toggle('hidden', !state.sidebarOpen)
    sidebarEl.innerHTML = renderSidebar(state.recentFiles, state.sidebarOpen)
    if (state.sidebarOpen) {
      attachSidebar(state.recentFiles, (name) => {
        const handle = getFileHandle(name)
        if (handle) {
          handle.getFile().then(file => {
            if (file.name.match(FILE_EXT_RE)) {
              handleFile(file)
              return
            }
            document.getElementById('file-input')?.click()
          }).catch(() => {
            document.getElementById('file-input')?.click()
          })
        } else {
          document.getElementById('file-input')?.click()
        }
      })
    }

    const statusEl = document.getElementById('status-bar')!
    statusEl.innerHTML = renderStatusBar(state, state.file?.name ?? '')
  }

  updateUI()
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}
