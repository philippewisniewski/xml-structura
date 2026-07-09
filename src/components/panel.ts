const MIN_PANEL_PCT = 20
const MAX_PANEL_PCT = 80

export function setupPanelResize(): void {
  const container = document.querySelector('main')
  const left = document.getElementById('panel-xml')
  const right = document.getElementById('panel-output')
  if (!container || !left || !right) return

  let isDragging = false

  const handle = document.createElement('div')
  handle.className = 'w-1 cursor-col-resize bg-gray-700/50 hover:bg-blue-500/50 transition-colors shrink-0 relative z-10'
  handle.dataset.panelHandle = ''
  container.insertBefore(handle, right)

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    isDragging = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  })

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    const rect = container.getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    const clamped = Math.max(MIN_PANEL_PCT, Math.min(MAX_PANEL_PCT, pct))
    left.style.width = `${clamped}%`
    right.style.width = `${100 - clamped}%`
  })

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  })
}
