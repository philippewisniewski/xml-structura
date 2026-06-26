import { useMemo } from 'react'
import { useApp } from '../App'
import { JsonTree } from './JsonTree'
import { RawJsonPreview } from './RawJsonPreview'

export function JsonPanel() {
  const { parsedData, isParsing, parseError, viewMode } = useApp()

  const jsonContent = useMemo(() => {
    if (!parsedData) return ''
    return JSON.stringify(parsedData, null, 2)
  }, [parsedData])

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
    <div className='flex min-h-0 flex-1 flex-col'>
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
