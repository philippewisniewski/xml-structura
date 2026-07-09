import type { RecentFile } from '../hooks/use-recent-files'

interface SidebarProps {
  recentFiles: RecentFile[]
  onSelect: (name: string) => void
}

export function Sidebar({ recentFiles, onSelect }: SidebarProps) {
  return (
    <div className="w-56 shrink-0 border-r border-gray-700/50 bg-gray-900/40 flex flex-col">
      <div className="px-3 py-2 text-xs font-medium text-gray-400 border-b border-gray-700/50">
        Recent Files
      </div>
      <div className="flex-1 overflow-y-auto">
        {recentFiles.length === 0 ? (
          <div className="p-3 text-xs text-gray-500">No recent files</div>
        ) : (
          recentFiles.map(f => (
            <button
              key={f.name}
              onClick={() => onSelect(f.name)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700/30 hover:text-gray-200 transition-colors truncate"
            >
              {f.name}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
