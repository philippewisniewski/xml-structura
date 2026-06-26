import { useState, useCallback } from 'react'
import { useApp } from '../App'

export function Toolbar() {
  const {
    fileName,
    toggleSidebar,
    toggleTheme,
    theme,
    clearFile,
    loadUrl
  } = useApp()

  const [url, setUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

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

  return (
    <header className='flex h-10 items-center justify-between border-b border-border bg-background px-3 select-none'>
      <div className='flex items-center gap-2 flex-1 min-w-0'>
        <button
          onClick={toggleSidebar}
          className='flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
          title='Toggle recent files'
        >
          <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <rect x='2' y='3' width='12' height='1.5' rx='0.75' fill='currentColor' />
            <rect x='2' y='7.25' width='12' height='1.5' rx='0.75' fill='currentColor' />
            <rect x='2' y='11.5' width='12' height='1.5' rx='0.75' fill='currentColor' />
          </svg>
        </button>
        <h1 className='text-sm font-semibold text-foreground shrink-0'>xml2json</h1>
        {fileName ? (
          <>
            <span className='text-muted-foreground shrink-0'>/</span>
            <span className='text-sm text-muted-foreground truncate max-w-[200px]'>
              {fileName}
            </span>
            <button
              onClick={clearFile}
              className='ml-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0'
            >
              ✕
            </button>
          </>
        ) : (
          <div className='flex items-center gap-1.5 ml-2 flex-1 max-w-md'>
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
              className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors'
              title='Fetch URL'
            >
              {isFetching ? (
                <span className='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
              ) : (
                <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <line x1='22' y1='2' x2='11' y2='13' />
                  <polygon points='22 2 15 22 11 13 2 9 22 2' />
                </svg>
              )}
            </button>
            {fetchError && (
              <span className='text-xs text-destructive truncate max-w-[200px]'>{fetchError}</span>
            )}
          </div>
        )}
      </div>

      <div className='flex items-center gap-2 shrink-0'>
        <button
          onClick={toggleTheme}
          className='flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
          title='Toggle theme'
        >
          {theme === 'dark' ? (
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='12' cy='12' r='5' />
              <line x1='12' y1='1' x2='12' y2='3' />
              <line x1='12' y1='21' x2='12' y2='23' />
              <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
              <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
              <line x1='1' y1='12' x2='3' y2='12' />
              <line x1='21' y1='12' x2='23' y2='12' />
              <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
              <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
            </svg>
          ) : (
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}
