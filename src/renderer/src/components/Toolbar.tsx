import { useApp } from '../App'
import { cn } from '../lib/utils'

export function Toolbar() {
  const {
    fileName,
    parserMode,
    setParserMode,
    toggleSidebar,
    toggleTheme,
    theme,
    mcpRunning,
    clearFile
  } = useApp()

  return (
    <header className='flex h-10 items-center justify-between border-b border-border bg-background px-3 select-none'>
      <div className='flex items-center gap-2'>
        <button
          onClick={toggleSidebar}
          className='flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
          title='Toggle recent files'
        >
          <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <rect x='2' y='3' width='12' height='1.5' rx='0.75' fill='currentColor' />
            <rect x='2' y='7.25' width='12' height='1.5' rx='0.75' fill='currentColor' />
            <rect x='2' y='11.5' width='12' height='1.5' rx='0.75' fill='currentColor' />
          </svg>
        </button>
        <h1 className='text-sm font-semibold text-foreground'>xml2json</h1>
        {fileName && (
          <>
            <span className='text-muted-foreground'>/</span>
            <span className='text-sm text-muted-foreground truncate max-w-[200px]'>
              {fileName}
            </span>
            <button
              onClick={clearFile}
              className='ml-1 text-xs text-muted-foreground hover:text-destructive transition-colors'
            >
              ✕
            </button>
          </>
        )}
      </div>

      <div className='flex items-center gap-2'>
        {mcpRunning && (
          <span className='flex items-center gap-1.5 text-xs text-green-500'>
            <span className='h-2 w-2 rounded-full bg-green-500' />
            MCP
          </span>
        )}
        <select
          value={parserMode}
          onChange={e => setParserMode(e.target.value as 'xml' | 'gpx')}
          className='h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring'
        >
          <option value='xml'>XML</option>
          <option value='gpx'>GPX</option>
        </select>
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
