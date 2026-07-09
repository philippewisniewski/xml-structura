import type { Status } from '../hooks/useParser'

interface StatusBarProps {
  status: Status
  progress: number
  error: string | null
  fileName: string
}

export function StatusBar({ status, progress, error, fileName }: StatusBarProps) {
  const statusText = status === 'parsing'
    ? `Parsing... ${progress}%`
    : status === 'done'
    ? `Done \u2014 ${fileName}`
    : status === 'error'
    ? `Error: ${error}`
    : 'Ready'

  return (
    <div className="flex items-center gap-2 border-t border-gray-700/50 bg-gray-900/60 px-3 py-1 text-xs text-gray-400 shrink-0">
      <span>{statusText}</span>
      {status === 'parsing' && (
        <>
          <div className="flex-1" />
          <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
    </div>
  )
}
