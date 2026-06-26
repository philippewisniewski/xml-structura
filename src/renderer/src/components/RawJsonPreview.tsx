import { useRef, useEffect, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { useApp } from '../App'

const themeCompartment = new Compartment()

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

interface RawJsonPreviewProps {
  jsonContent: string
}

export function RawJsonPreview({ jsonContent }: RawJsonPreviewProps) {
  const { theme } = useApp()

  const viewRef = useRef<EditorView | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  const containerRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) {
        if (!jsonContent) return

        if (viewRef.current) {
          viewRef.current.destroy()
          viewRef.current = null
        }

        try {
          const state = EditorState.create({
            doc: jsonContent,
            extensions: buildExtensions(themeRef.current),
          })

          const view = new EditorView({
            state,
            parent: el,
          })

          viewRef.current = view
        } catch (err) {
          console.error('[RawJsonPreview] Editor creation failed:', err)
        }
      } else {
        if (viewRef.current) {
          viewRef.current.destroy()
          viewRef.current = null
        }
      }
    },
    [jsonContent],
  )

  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(
        theme === 'dark' ? oneDark : [],
      ),
    })
  }, [theme])

  return (
    <div ref={containerRef} className='min-h-0 flex-1 overflow-hidden' />
  )
}
