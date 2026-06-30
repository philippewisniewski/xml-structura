import { useRef, useEffect, useState, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { useApp } from '../App'

const themeCompartment = new Compartment()
const CHUNK_SIZE = 512 * 1024
const MAX_LOAD = 5 * 1024 * 1024

function buildExtensions(theme: 'light' | 'dark') {
  return [
    basicSetup,
    json(),
    EditorView.lineWrapping,
    themeCompartment.of(theme === 'dark' ? oneDark : []),
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '12px',
      },
      '.cm-scroller': {
        fontFamily:
          "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      },
      '.cm-line': {
        padding: '0 2px',
      },
      '.cm-gutters': {
        borderRight: '1px solid hsl(var(--border))',
        backgroundColor: 'transparent',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'hsl(var(--accent))',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'transparent',
        border: 'none',
        color: 'hsl(var(--muted-foreground))',
      },
      '.cm-matchingBracket': {
        backgroundColor: 'hsl(var(--accent))',
        outline: '1px solid hsl(var(--border))',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'hsl(var(--accent)) !important',
      },
    }),
  ]
}

function LargeRawView() {
  const { theme, jsonSummary } = useApp()
  const [chunked, setChunked] = useState('')
  const [loaded, setLoaded] = useState(0)
  const [loading, setLoading] = useState(false)
  const viewRef = useRef<EditorView | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const total = jsonSummary?.fileSize ?? 0
  const nextBytes = loaded + CHUNK_SIZE

  useEffect(() => {
    if (!jsonSummary) return
    setChunked(jsonSummary.preview)
    setLoaded(jsonSummary.preview.length)
  }, [jsonSummary])

  // init editor once
  useEffect(() => {
    if (!containerRef.current) return
    const state = EditorState.create({
      doc: chunked || '',
      extensions: buildExtensions(theme),
    })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // update editor content and theme
  useEffect(() => {
    if (!viewRef.current) return
    const doc = viewRef.current.state.doc
    if (chunked && (doc.length !== chunked.length || doc.toString() !== chunked)) {
      viewRef.current.dispatch({
        changes: { from: 0, to: doc.length, insert: chunked }
      })
    }
  }, [chunked])

  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(theme === 'dark' ? oneDark : []),
    })
  }, [theme])

  const handleLoadMore = useCallback(async () => {
    if (loading || !jsonSummary) return
    setLoading(true)
    try {
      const result = await window.api.readJsonChunk(0, Math.min(nextBytes, MAX_LOAD))
      if (result !== null) {
        setChunked(result)
        setLoaded(result.length)
      }
    } catch { }
    setLoading(false)
  }, [loading, jsonSummary, nextBytes])

  const reachedMax = loaded >= MAX_LOAD
  const allLoaded = loaded >= total || reachedMax

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div ref={containerRef} className='min-h-0 flex-1 overflow-hidden' />
      {!allLoaded && (
        <div className='flex items-center justify-center border-t border-border p-2'>
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className='rounded-md bg-accent px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50'
          >
            {loading ? 'Loading…' : `Load more (${(nextBytes / 1024).toFixed(0)} KB)`}
          </button>
        </div>
      )}
      {reachedMax && total > MAX_LOAD && (
        <div className='flex items-center justify-center border-t border-border p-2 text-[10px] text-muted-foreground'>
          Preview limited to {MAX_LOAD / 1024 / 1024} MB — use MCP for full access
        </div>
      )}
    </div>
  )
}

export function RawJsonPreview() {
  const { jsonContent, isLargeFile } = useApp()

  if (isLargeFile) {
    return <LargeRawView />
  }

  if (jsonContent === null) {
    return <div className='min-h-0 flex-1 overflow-hidden' />
  }

  return <SmallRawView />
}

function SmallRawView() {
  const { theme, jsonContent } = useApp()
  const viewRef = useRef<EditorView | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (containerRef.current) {
      const state = EditorState.create({
        doc: jsonContent || '',
        extensions: buildExtensions(theme),
      })
      const view = new EditorView({ state, parent: containerRef.current })
      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewRef.current || jsonContent === null) return
    const doc = viewRef.current.state.doc
    if (doc.length !== jsonContent.length || doc.toString() !== jsonContent) {
      viewRef.current.dispatch({
        changes: { from: 0, to: doc.length, insert: jsonContent }
      })
    }
  }, [jsonContent])

  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(theme === 'dark' ? oneDark : []),
    })
  }, [theme])

  return <div ref={containerRef} className='min-h-0 flex-1 overflow-hidden' />
}
