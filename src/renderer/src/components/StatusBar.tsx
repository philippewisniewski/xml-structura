import { useApp } from '../App'

export function StatusBar() {
  const { fileSize, fileLines, parsedData, parseError, copyJson, downloadJson, mcpRunning } =
    useApp()

  return (
    <footer className='flex h-7 items-center justify-between border-t border-border bg-muted/30 px-3'>
      <div className='flex items-center gap-3 text-[11px] text-muted-foreground'>
        {fileSize !== null && (
          <span>
            {fileSize >= 1024 * 1024
              ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
              : fileSize >= 1024
                ? `${(fileSize / 1024).toFixed(1)} KB`
                : `${fileSize} B`}
          </span>
        )}
        {fileLines !== null && <span>{fileLines.toLocaleString()} lines</span>}
        {parsedData !== null && (
          <span className='text-green-500'>✓ Parsed</span>
        )}
        {parseError !== null && (
          <span className='text-destructive'>✗ Error</span>
        )}
      </div>
      <div className='flex items-center gap-2'>
        {mcpRunning && (
          <span className='flex items-center gap-1 text-[11px] text-green-500'>
            <span className='h-1.5 w-1.5 rounded-full bg-green-500' />
            MCP :4283
          </span>
        )}
        {parsedData !== null && (
          <>
            <button
              onClick={copyJson}
              className='rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
            >
              Copy JSON
            </button>
            <button
              onClick={downloadJson}
              className='rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
            >
              Download
            </button>
          </>
        )}
      </div>
    </footer>
  )
}
