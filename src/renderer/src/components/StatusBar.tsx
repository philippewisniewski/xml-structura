import { useApp } from '../App'

export function StatusBar() {
  const { mcpRunning } = useApp()

  return (
    <footer className='flex h-6 items-center justify-end border-t border-border bg-muted/30 px-3'>
      {mcpRunning && (
        <span className='flex items-center gap-1.5 text-[11px] text-green-500'>
          <span className='h-1.5 w-1.5 rounded-full bg-green-500' />
          MCP
        </span>
      )}
    </footer>
  )
}
