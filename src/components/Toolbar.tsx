import type { Theme } from '../hooks/useParser'

interface ToolbarProps {
  onOpenFile: () => void
  onCopy: () => void
  onDownload: () => void
  onThemeToggle: () => void
  onSidebarToggle: () => void
  onRawToggle: () => void
  theme: Theme
  preserveRaw: boolean
  fileName: string
  hasResult: boolean
}

export function Toolbar({
  onOpenFile, onCopy, onDownload,
  onThemeToggle, onSidebarToggle, onRawToggle, theme,
  preserveRaw, fileName, hasResult
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm shrink-0">
      <button
        onClick={onSidebarToggle}
        className="p-1 rounded hover:bg-gray-700 transition-colors"
        title="Toggle sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="2" y1="3" x2="14" y2="3" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="13" x2="14" y2="13" />
        </svg>
      </button>
      <button
        onClick={onOpenFile}
        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium transition-colors"
      >
        Open File
      </button>

      <div className="h-4 w-px bg-gray-600" />

      <div className="flex-1" />

      <span className="text-xs text-gray-500 truncate max-w-48">{fileName}</span>

      <button
        onClick={onCopy}
        className={`px-2 py-1 rounded text-xs transition-colors ${
          hasResult
            ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            : 'bg-gray-800 text-gray-600 opacity-30 pointer-events-none'
        }`}
      >
        Copy
      </button>
      <button
        onClick={onDownload}
        className={`px-2 py-1 rounded text-xs transition-colors ${
          hasResult
            ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            : 'bg-gray-800 text-gray-600 opacity-30 pointer-events-none'
        }`}
      >
        DL JSON
      </button>

      <div className="h-4 w-px bg-gray-600" />

      <button
        onClick={onRawToggle}
        className={`px-2 py-1 rounded text-xs transition-colors ${
          preserveRaw
            ? 'bg-blue-600 text-white hover:bg-blue-500'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
        title="Preserve raw formatting (attribute order + whitespace)"
      >
        Raw
      </button>
      <button
        onClick={onThemeToggle}
        className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
      >
        {theme === 'dark' ? '\u2600' : '\u263E'}
      </button>
    </div>
  )
}
