import { useRef, useEffect, useCallback, useState, type DragEvent } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'
import { useApp } from '../App'

const themeCompartment = new Compartment()

function buildExtensions(theme: 'light' | 'dark') {
  return [
    basicSetup,
    xml(),
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

export function XmlPreview() {
  const { fileName, isParsing, parseProgress, parseError, isParsed, theme, openFileDialog, loadFile } = useApp()
  const [isDragging, setIsDragging] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (!file) return
      if (!file.name.endsWith('.xml') && !file.name.endsWith('.gpx')) return

      const filePath = window.api.getPathForFile(file)
      if (!filePath) return

      await loadFile(filePath)
    },
    [loadFile]
  )

  const viewRef = useRef<EditorView | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  const appendToEditor = useCallback((text: string) => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      changes: { from: viewRef.current.state.doc.length, insert: text }
    })
  }, [])

  const xmlAccumulator = useRef('')

  useEffect(() => {
    if (isParsing) {
      xmlAccumulator.current = ''
    }
  }, [isParsing])

  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(
        theme === 'dark' ? oneDark : [],
      ),
    })
  }, [theme])

  useEffect(() => {
    const unsubXml = window.api.on('xml-chunk', (chunk: unknown) => {
      const text = String(chunk)
      xmlAccumulator.current += text
      appendToEditor(text)
    })
    return () => { unsubXml() }
  }, [appendToEditor])

  // Reset editor when a new file starts loading
  const hasStartedRef = useRef(false)
  useEffect(() => {
    if (isParsing || isParsed) {
      hasStartedRef.current = true
    } else {
      hasStartedRef.current = false
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [isParsing, isParsed])

  const handleContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
      const state = EditorState.create({
        doc: '',
        extensions: buildExtensions(themeRef.current),
      })
      const view = new EditorView({ state, parent: el })
      viewRef.current = view
    } else {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [])

  const outerProps = {
    onDragOver: handleDragOver as any,
    onDragLeave: handleDragLeave as any,
    onDrop: handleDrop as any
  }

  if (parseError) {
    return (
      <div ref={dropRef} {...outerProps} className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <p className='text-sm font-medium text-destructive'>Parse Error</p>
          <p className='mt-1 text-xs text-muted-foreground'>{parseError}</p>
        </div>
      </div>
    )
  }

  if (!isParsed && !isParsing) {
    return (
      <div
        ref={dropRef}
        {...outerProps}
        className='flex h-full items-center justify-center p-6'
      >
        <div className='text-center'>
          <div
            className={`mx-auto mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            <svg
              width='32'
              height='32'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.5'
              className='mb-3 text-muted-foreground'
            >
              <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
              <polyline points='17 8 12 3 7 8' />
              <line x1='12' y1='3' x2='12' y2='15' />
            </svg>
            <p className='text-sm font-medium text-foreground'>Drop XML or GPX here</p>
          </div>

          <div className='relative mb-4'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t border-border' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>or</span>
            </div>
          </div>

          <button
            onClick={openFileDialog}
            className='inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors'
          >
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
            </svg>
            Choose File
          </button>

          <p className='mt-4 text-xs text-muted-foreground'>XML Preview</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={dropRef} {...outerProps} className='relative flex h-full min-h-0 flex-col'>
      {isDragging && (
        <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80'>
          <p className='text-sm font-medium text-foreground'>Drop XML or GPX here</p>
        </div>
      )}
      <div ref={handleContainerRef} className='min-h-0 flex-1 overflow-hidden' />
    </div>
  )
}
