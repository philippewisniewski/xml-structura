import { useRef, useEffect, useMemo, useCallback, useState, type DragEvent } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'
import formatXml from 'xml-formatter'
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

function formatXmlContent(raw: string): string {
  try {
    return formatXml(raw, {
      indentation: '  ',
      collapseContent: true,
      lineSeparator: '\n',
    })
  } catch {
    return raw
  }
}

export function XmlPreview() {
  const { fileContent, fileName, isParsing, parseError, theme, openFileDialog, loadFile } = useApp()
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

      const text = await file.text()
      await loadFile(text, file.name)
    },
    [loadFile]
  )

  const displayContent = useMemo(() => {
    if (!fileContent) return ''
    return formatXmlContent(fileContent)
  }, [fileContent])

  const viewRef = useRef<EditorView | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  const containerRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) {
        if (!displayContent) return

        if (viewRef.current) {
          viewRef.current.destroy()
          viewRef.current = null
        }

        try {
          const state = EditorState.create({
            doc: displayContent,
            extensions: buildExtensions(themeRef.current),
          })

          const view = new EditorView({
            state,
            parent: el,
          })

          viewRef.current = view
        } catch (err) {
          console.error('[XmlPreview] Editor creation failed:', err)
        }
      } else {
        if (viewRef.current) {
          viewRef.current.destroy()
          viewRef.current = null
        }
      }
    },
    [displayContent],
  )

  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(
        theme === 'dark' ? oneDark : [],
      ),
    })
  }, [theme])

  if (isParsing) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='flex items-center gap-2'>
          <span className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          <span className='text-sm text-muted-foreground'>Parsing...</span>
        </div>
      </div>
    )
  }

  if (parseError) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <p className='text-sm font-medium text-destructive'>Parse Error</p>
          <p className='mt-1 text-xs text-muted-foreground'>{parseError}</p>
        </div>
      </div>
    )
  }

  if (!fileContent) {
    return (
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
    <div className='flex h-full flex-col'>
      <div className='flex items-center gap-2 border-b border-border px-3 py-1.5'>
        <svg
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          className='text-muted-foreground'
        >
          <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
          <polyline points='14 2 14 8 20 8' />
        </svg>
        <span className='text-xs font-medium text-foreground'>{fileName}</span>
      </div>
      <div ref={containerRef} className='min-h-0 flex-1 overflow-hidden' />
    </div>
  )
}
