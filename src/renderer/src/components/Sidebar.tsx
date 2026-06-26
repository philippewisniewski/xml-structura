import { useApp } from '../App'

export function Sidebar() {
  const { recentFiles, loadFile, loadUrl, clearRecentFiles } = useApp()

  const handleClick = async (file: { name: string; path: string }) => {
    if (file.path.startsWith('http://') || file.path.startsWith('https://')) {
      await loadUrl(file.path)
    } else {
      const result = await window.api.readFile(file.path)
      if (result) {
        await loadFile(result.content, result.name, file.path)
      }
    }
  }

  return (
    <aside className='flex w-56 flex-col border-r border-border bg-muted/30'>
      <div className='flex items-center justify-between px-3 py-2'>
        <span className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>Recent</span>
        {recentFiles.length > 0 && (
          <button
            onClick={clearRecentFiles}
            className='text-xs text-muted-foreground hover:text-destructive transition-colors'
          >
            Clear
          </button>
        )}
      </div>
      <div className='flex-1 overflow-y-auto px-2 pb-2'>
        {recentFiles.length === 0 ? (
          <p className='px-1 text-xs text-muted-foreground'>No recent files</p>
        ) : (
          <ul className='space-y-0.5'>
            {recentFiles.map((file, i) => (
              <li key={`${file.path}-${i}`}>
                <button
                  onClick={() => handleClick(file)}
                  className='w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent transition-colors'
                >
                  <span className='block truncate font-medium'>{file.name}</span>
                  <span className='block truncate text-[10px] text-muted-foreground'>
                    {new Date(file.timestamp).toLocaleDateString()}
                    {file.path.startsWith('http') ? ' · URL' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
