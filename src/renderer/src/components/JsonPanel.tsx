import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../App'
import { JsonTree } from './JsonTree'
import { RawJsonPreview } from './RawJsonPreview'

export function JsonPanel() {
  const { parsedData, isParsing, parseError, copyJson, downloadJson } = useApp()
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree')
  const [editorName, setEditorName] = useState<string | null>(null)

  useEffect(() => {
    window.api.detectEditors().then(setEditorName)
  }, [])

  const jsonContent = useMemo(() => {
    if (!parsedData) return ''
    return JSON.stringify(parsedData, null, 2)
  }, [parsedData])

  const handleOpenInEditor = async () => {
    if (!jsonContent) return
    await window.api.openInEditor(jsonContent)
  }

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

  if (!parsedData) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <svg
            width='40'
            height='40'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='1'
            className='mx-auto mb-3 text-muted-foreground/40'
          >
            <polyline points='4 17 10 11 4 5' />
            <line x1='12' y1='19' x2='20' y2='19' />
          </svg>
          <p className='text-sm text-muted-foreground'>JSON Output</p>
          <p className='mt-1 text-xs text-muted-foreground/60'>Parsed data will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex items-center justify-between border-b border-border px-3 py-1.5'>
        <div className='flex items-center gap-1'>
          <button
            onClick={() => setViewMode('tree')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              viewMode === 'tree'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              viewMode === 'raw'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Raw
          </button>
        </div>
        <div className='flex gap-1'>
          <button
            onClick={handleOpenInEditor}
            disabled={!editorName}
            className='rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
            title={
              editorName
                ? `Open in ${editorName}`
                : 'No editor detected (install VS Code, Cursor, or Zed)'
            }
          >
            {editorName ? `Open in ${editorName}` : 'Open in Editor'}
          </button>
          <button
            onClick={copyJson}
            className='flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
            title='Copy JSON'
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
              <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
            </svg>
          </button>
          <button
            onClick={downloadJson}
            className='flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
            title='Download JSON'
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
              <polyline points='7 10 12 15 17 10' />
              <line x1='12' y1='15' x2='12' y2='3' />
            </svg>
          </button>
        </div>
      </div>
      {viewMode === 'tree' ? (
        <div className='flex-1 overflow-auto p-3 font-mono text-xs leading-5'>
          <JsonTree />
        </div>
      ) : (
        <div className='flex min-h-0 flex-1 flex-col'>
          <RawJsonPreview jsonContent={jsonContent} />
        </div>
      )}
    </div>
  )
}
