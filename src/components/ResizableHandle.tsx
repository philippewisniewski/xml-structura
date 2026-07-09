import { useRef, useEffect } from 'react'

const MIN_PANEL_PCT = 20
const MAX_PANEL_PCT = 80

export function ResizableHandle() {
  const handleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = handleRef.current
    if (!el) return
    const parent = el.parentElement
    if (!parent || parent.children.length < 3) return

    let isDragging = false

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      isDragging = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const rect = parent.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      const clamped = Math.max(MIN_PANEL_PCT, Math.min(MAX_PANEL_PCT, pct))
      const left = parent.children[0] as HTMLElement
      const right = parent.children[2] as HTMLElement
      left.style.width = `${clamped}%`
      right.style.width = `${100 - clamped}%`
    }

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div
      ref={handleRef}
      className="w-1 cursor-col-resize bg-gray-700/50 hover:bg-blue-500/50 transition-colors shrink-0 relative z-10"
    />
  )
}
