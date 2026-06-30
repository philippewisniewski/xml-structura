import { useApp } from '../App'
import { JsonTree } from './JsonTree'
import { RawJsonPreview } from './RawJsonPreview'

export function JsonPanel() {
  const { isParsing, parseProgress, parseError, viewMode, isParsed } = useApp()

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

  if (!isParsed && !isParsing) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <div className='flex h-16 w-16 items-center justify-center rounded-full bg-accent/50 mx-auto mb-3'>
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.5'
              className='text-muted-foreground'
            >
              <polyline points='4 17 10 11 4 5' />
              <line x1='12' y1='19' x2='20' y2='19' />
            </svg>
          </div>
          <p className='text-sm text-muted-foreground'>JSON Output</p>
          <p className='mt-1 text-xs text-muted-foreground/60'>Parsed data will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      {viewMode === 'raw' ? (
        <RawJsonPreview />
      ) : (
        <div className='flex-1 overflow-auto p-3 font-mono text-xs leading-5'>
          {isParsing && parseProgress && parseProgress.phase === 'parsing' ? (
            <div className='flex h-full items-center justify-center text-xs text-muted-foreground'>
              Parsing...
            </div>
          ) : (
            <JsonTree />
          )}
        </div>
      )}
    </div>
  )
}
