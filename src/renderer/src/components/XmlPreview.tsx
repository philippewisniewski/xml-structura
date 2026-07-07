import { useEffect, useCallback, useRef, useState, type DragEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useApp } from '../App'
import { tokenizeXml, renderTokens } from '../utils/tokenize'

function formatXml(xml: string): string {
  let formatted = ''
  let indent = 0
  xml = xml.replace(/>\s+</g, '><')
  let i = 0
  while (i < xml.length) {
    if (xml[i] === '<') {
      const end = xml.indexOf('>', i)
      if (end === -1) break
      const tag = xml.slice(i, end + 1)
      if (tag.startsWith('<?') || tag.startsWith('<![CDATA[')) {
        formatted += tag
      } else if (tag.startsWith('</')) {
        indent--
        formatted += '\n' + '  '.repeat(Math.max(0, indent)) + tag
      } else if (tag.endsWith('/>')) {
        formatted += '\n' + '  '.repeat(indent) + tag
      } else {
        formatted += '\n' + '  '.repeat(indent) + tag
        if (!tag.startsWith('<!')) indent++
      }
      i = end + 1
    } else {
      const nextTag = xml.indexOf('<', i)
      const text = nextTag === -1 ? xml.slice(i) : xml.slice(i, nextTag)
      if (text.trim()) {
        formatted += text.trim()
      }
      i = nextTag !== -1 ? nextTag : xml.length
    }
  }
  return formatted.trimStart()
}

function XmlContent() {
  const { filePath, isParsed } = useApp()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isParsed || !filePath) return
    setLoading(true)
    window.api.readXmlFile(filePath).then(result => {
      if (result) {
        setContent(formatXml(result))
      }
      setLoading(false)
    })
  }, [isParsed, filePath])

  const lines = content ? content.split('\n') : []

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
        Loading XML...
      </div>
    )
  }

  if (!content) {
    return (
      <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
        No XML content available
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className='min-h-0 flex-1 overflow-auto font-mono text-xs'
      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
            className='flex whitespace-pre leading-5 hover:bg-[var(--accent)]/30'
          >
            <span className='w-[4ch] shrink-0 text-right text-muted-foreground select-none pr-3'>
              {virtualItem.index + 1}
            </span>
            <span
              className='flex-1'
              dangerouslySetInnerHTML={{ __html: renderTokens(tokenizeXml(lines[virtualItem.index])) }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function XmlPreview() {
  const { filePath, isParsing, parseError, isParsed, openFileDialog, loadFile } = useApp()
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (!file) return
      if (!file.name.endsWith('.xml') && !file.name.endsWith('.gpx')) return

      const filePath = window.api.getPathForFile(file)
      if (!filePath) return

      await loadFile(filePath)
    },
    [loadFile]
  )

  const outerProps = {
    onDragOver: handleDragOver as any,
    onDragLeave: handleDragLeave as any,
    onDrop: handleDrop as any
  }

  if (parseError) {
    return (
      <div {...outerProps} className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <p className='text-sm font-medium text-destructive'>Parse Error</p>
          <p className='mt-1 text-xs text-muted-foreground'>{parseError}</p>
        </div>
      </div>
    )
  }

  if (!isParsed && !isParsing) {
    return (
      <div {...outerProps} className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <div
            className={`mx-auto mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            <svg
              width='32'
              height='32'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.5'
              className='mb-3 text-muted-foreground'
            >
              <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
              <polyline points='17 8 12 3 7 8' />
              <line x1='12' y1='3' x2='12' y2='15' />
            </svg>
            <p className='text-sm font-medium text-foreground'>Drop XML or GPX here</p>
          </div>

          <div className='relative mb-4'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t border-border' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>or</span>
            </div>
          </div>

          <button
            onClick={openFileDialog}
            className='inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors'
          >
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
            </svg>
            Choose File
          </button>

          <p className='mt-4 text-xs text-muted-foreground'>XML Preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className='relative flex h-full min-h-0 flex-col'>
      {isDragging && (
        <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80'>
          <p className='text-sm font-medium text-foreground'>Drop XML or GPX here</p>
        </div>
      )}
      <XmlContent />
    </div>
  )
}
