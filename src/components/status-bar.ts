import type { AppState } from '../app'

export function renderStatusBar(state: AppState, fileName: string): string {
  const statusText = state.status === 'parsing'
    ? `Parsing... ${state.progress}%`
    : state.status === 'done'
    ? `Done — ${fileName}`
    : state.status === 'error'
    ? `Error: ${state.error}`
    : 'Ready'

  return `
    <span id="status-text">${escapeHtml(statusText)}</span>
    ${state.status === 'parsing' ? `
      <div class="flex-1"></div>
      <div class="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full bg-blue-500 rounded-full transition-all duration-200" style="width:${state.progress}%"></div>
      </div>
    ` : ''}
  `
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
