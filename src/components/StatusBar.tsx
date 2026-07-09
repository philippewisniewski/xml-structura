import type { Status } from '../hooks/useParser'
import type { GpxMetrics } from '../parser/gpx-extractor'

interface StatusBarProps {
  status: Status
  progress: number
  error: string | null
  fileName: string
  gpxMetrics?: GpxMetrics | null
}

export function StatusBar({ status, progress, error, fileName, gpxMetrics }: StatusBarProps) {
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
      {gpxMetrics && (
        <>
          <div className="h-4 w-px bg-gray-600" />
          <span className="text-gray-500">{gpxMetrics.totalDistanceKm.toFixed(1)} km</span>
        </>
      )}
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
