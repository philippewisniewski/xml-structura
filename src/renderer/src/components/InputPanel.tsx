import { useState, useCallback, useRef, type DragEvent } from 'react'
import { useApp } from '../App'

export function InputPanel() {
  const { openFileDialog, loadUrl, loadFile, fileContent, isParsing, parseError, fileName } = useApp()
  const [url, setUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
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
      if (!file.name.endsWith('.xml') && !file.name.endsWith('.gpx')) {
        return
      }

      const text = await file.text()
      await loadFile(text, file.name)
    },
    [loadFile]
  )

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return
    setFetchError(null)
    setIsFetching(true)
    try {
      await loadUrl(url.trim())
    } catch (err) {
      setFetchError((err as Error).message)
    } finally {
      setIsFetching(false)
    }
  }, [url, loadUrl])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleFetch()
    },
    [handleFetch]
  )

  const hasContent = fileContent !== null

  return (
    <div className='flex h-full flex-col gap-3 p-3 overflow-y-auto'>
      {!hasContent ? (
        <>
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
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
              className='mb-2 text-muted-foreground'
            >
              <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
              <polyline points='17 8 12 3 7 8' />
              <line x1='12' y1='3' x2='12' y2='15' />
            </svg>
            <p className='text-sm font-medium text-foreground'>Drop XML or GPX here</p>
          </div>

          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t border-border' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>or</span>
            </div>
          </div>

          <button
            onClick={openFileDialog}
            className='flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors'
          >
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
            </svg>
            Choose File
          </button>

          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t border-border' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>or paste a URL</span>
            </div>
          </div>

          <div className='flex gap-2'>
            <input
              type='url'
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='https://example.com/data.xml'
              className='min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
            />
            <button
              onClick={handleFetch}
              disabled={!url.trim() || isFetching}
              className='flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors'
            >
              {isFetching ? (
                <span className='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
              ) : (
                'Fetch'
              )}
            </button>
          </div>

          {fetchError && (
            <p className='text-xs text-destructive'>{fetchError}</p>
          )}
        </>
      ) : (
        <div className='flex flex-col gap-2'>
          <button
            onClick={openFileDialog}
            className='flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors'
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
            </svg>
            Open different file
          </button>

          <div className='flex gap-2'>
            <input
              type='url'
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='https://example.com/data.xml'
              className='min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
            />
            <button
              onClick={handleFetch}
              disabled={!url.trim() || isFetching}
              className='flex shrink-0 items-center rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors'
            >
              {isFetching ? (
                <span className='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
              ) : (
                'Fetch'
              )}
            </button>
          </div>
        </div>
      )}

      {isParsing && (
        <div className='flex items-center justify-center gap-2 py-4'>
          <span className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          <span className='text-xs text-muted-foreground'>Parsing...</span>
        </div>
      )}

      {parseError && (
        <div className='rounded-md bg-destructive/10 p-2'>
          <p className='text-xs text-destructive font-medium'>Error</p>
          <p className='text-xs text-destructive/80 mt-0.5'>{parseError}</p>
        </div>
      )}

      {fileContent && !isParsing && !parseError && (
        <div className='rounded-md bg-muted/50 p-2'>
          <p className='text-xs text-muted-foreground font-medium'>Loaded</p>
          <p className='text-xs text-foreground truncate mt-0.5'>{fileName}</p>
        </div>
      )}
    </div>
  )
}
