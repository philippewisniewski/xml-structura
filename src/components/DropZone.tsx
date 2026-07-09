import { useState, useEffect } from 'react'

interface DropZoneProps {
  onFile: (file: File) => void
}

export function DropZone({ onFile }: DropZoneProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      setVisible(true)
    }

    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null || (e.relatedTarget as Node).ownerDocument !== document) {
        setVisible(false)
      }
    }

    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)

    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex pointer-events-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        setVisible(false)
        const file = e.dataTransfer?.files?.[0]
        if (file) onFile(file)
      }}
    >
      <div className="m-auto flex items-center justify-center w-96 h-48 rounded-xl border-2 border-dashed border-blue-400 bg-gray-900/80 backdrop-blur-sm">
        <p className="text-blue-300 text-lg font-medium">Drop XML or GPX file here</p>
      </div>
    </div>
  )
}
