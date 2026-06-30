import { useApp } from '../App'

export function StatusBar() {
  const { mcpRunning, mcpPort, mcpError } = useApp()

  const dot = mcpError ? 'bg-destructive' : mcpRunning ? 'bg-green-500' : 'bg-muted-foreground'
  const color = mcpError ? 'text-destructive' : mcpRunning ? 'text-green-500' : 'text-muted-foreground'
  const label = mcpError ? 'Error' : mcpRunning ? 'xml2json' : 'Disconnected'

  return (
    <footer className='flex h-6 items-center justify-end border-t border-border bg-muted/30 px-3'>
      <span className={`flex items-center gap-1.5 text-[11px] ${color}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        MCP {label}{mcpRunning && mcpPort ? ` :${mcpPort}` : ''}{mcpError ? `: ${mcpError}` : ''}
      </span>
    </footer>
  )
}
