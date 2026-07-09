import { useReducer, useCallback } from 'react'
import { parseStream } from '../parser/sax-stream'
import { createTreeBuilder, type TreeNode } from '../parser/tree-builder'
import { extractGpxMetrics, type GpxMetrics } from '../parser/gpx-extractor'
import { saveRecentFile, loadRecentFiles } from './use-recent-files'
import type { RecentFile } from './use-recent-files'

export type Status = 'idle' | 'parsing' | 'done' | 'error'
export type ViewMode = 'tree' | 'json'
export type Theme = 'dark' | 'light'

export interface State {
  file: File | null
  tree: TreeNode | null
  status: Status
  error: string | null
  progress: number
  view: ViewMode
  theme: Theme
  sidebarOpen: boolean
  recentFiles: RecentFile[]
  expandedPaths: Set<string>
  gpxMetrics: GpxMetrics | null
}

export type Action =
  | { type: 'START_PARSE'; file: File }
  | { type: 'PROGRESS'; progress: number }
  | { type: 'COMPLETE'; tree: TreeNode; gpxMetrics: GpxMetrics | null }
  | { type: 'ERROR'; error: string }
  | { type: 'SET_VIEW'; view: ViewMode }
  | { type: 'TOGGLE_THEME' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_NODE'; path: string }
  | { type: 'SET_RECENT_FILES'; files: RecentFile[] }

const FILE_EXT_RE = /\.(xml|gpx|svg|rss|atom|xhtml)$/i

function initState(): State {
  const savedTheme = (localStorage.getItem('xml-structura-theme') as Theme) || 'dark'
  return {
    file: null,
    tree: null,
    status: 'idle',
    error: null,
    progress: 0,
    view: 'tree',
    theme: savedTheme,
    sidebarOpen: true,
    recentFiles: loadRecentFiles(),
    expandedPaths: new Set(),
    gpxMetrics: null,
  }
}

function appReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_PARSE':
      return { ...state, file: action.file, status: 'parsing', progress: 0, tree: null, error: null, gpxMetrics: null }
    case 'PROGRESS':
      return { ...state, progress: action.progress }
    case 'COMPLETE':
      return { ...state, tree: action.tree, status: 'done', progress: 100, gpxMetrics: action.gpxMetrics }
    case 'ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('xml-structura-theme', newTheme)
      return { ...state, theme: newTheme }
    }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'TOGGLE_NODE': {
      const next = new Set(state.expandedPaths)
      if (next.has(action.path)) {
        next.delete(action.path)
      } else {
        next.add(action.path)
      }
      return { ...state, expandedPaths: next }
    }
    case 'SET_RECENT_FILES':
      return { ...state, recentFiles: action.files }
    default:
      return state
  }
}

export function useParser() {
  const [state, dispatch] = useReducer(appReducer, undefined, initState)

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(FILE_EXT_RE)) return
    saveRecentFile({ name: file.name, lastOpened: Date.now() })
    dispatch({ type: 'SET_RECENT_FILES', files: loadRecentFiles() })
    dispatch({ type: 'START_PARSE', file })

    const builder = createTreeBuilder()

    parseStream(file, {
      onOpenTag: (tag, attrs) => builder.onOpenTag(tag, attrs),
      onText: (text) => builder.onText(text),
      onCloseTag: (tag) => builder.onCloseTag(tag),
      onProgress: (pct) => dispatch({ type: 'PROGRESS', progress: pct }),
      onComplete: () => {
        const tree = builder.root
        const gpxMetrics = extractGpxMetrics(tree)
        dispatch({ type: 'COMPLETE', tree, gpxMetrics })
      },
      onError: (err) => dispatch({ type: 'ERROR', error: err.message }),
    })
  }, [])

  return { state, dispatch, handleFile }
}
