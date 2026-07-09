import type { RecentFile } from '../hooks/use-recent-files'

export function renderSidebar(files: RecentFile[], isOpen: boolean): string {
  if (!isOpen) return ''
  if (files.length === 0) {
    return `
      <div class="p-3 text-xs text-gray-500">
        No recent files
      </div>
    `
  }

  return `
    <div class="flex flex-col h-full">
      <div class="px-3 py-2 text-xs font-medium text-gray-400 border-b border-gray-700/50">Recent Files</div>
      <div class="flex-1 overflow-y-auto">
        ${files.map(f => `
          <button class="recent-file w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700/30 hover:text-gray-200 transition-colors truncate"
            data-name="${escapeAttr(f.name)}">
            ${escapeHtml(f.name)}
          </button>
        `).join('')}
      </div>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function attachSidebar(
  files: RecentFile[],
  onSelect: (name: string) => void
): void {
  document.querySelectorAll('.recent-file').forEach(el => {
    el.addEventListener('click', () => {
      const name = (el as HTMLElement).dataset.name
      if (name) onSelect(name)
    })
  })
}
