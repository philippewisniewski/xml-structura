import { useMemo, useRef, useEffect } from 'react'
import { useApp } from '../App'

function highlightXml(xml: string): string {
  return xml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-green-500 italic">$1</span>')
    .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="text-blue-500">$2</span>')
    .replace(/(\s)([\w:-]+)(=)/g, '$1<span class="text-purple-500">$2</span>$3')
    .replace(/("[^"]*")/g, '<span class="text-amber-600 dark:text-amber-400">$1</span>')
    .replace(/(&lt;[^>]*\/&gt;)/g, '<span class="opacity-80">$1</span>')
}

function formatXml(xml: string): string {
  let formatted = ''
  let indent = 0
  const lines = xml.split(/\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      formatted += '\n'
      continue
    }
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<!--')) {
      formatted += trimmed + '\n'
      continue
    }
    if (trimmed.match(/^<\//)) {
      indent = Math.max(0, indent - 1)
    }
    formatted += '  '.repeat(indent) + trimmed + '\n'
    if (
      trimmed.match(/^<[^/?!][^>]*[^/]>\s*$/) &&
      !trimmed.match(/^<[^>]*\/>/) &&
      !trimmed.match(/^<\/[^>]*>$/)
    ) {
      indent++
    }
  }
  return formatted.trim()
}

export function XmlPreview() {
  const { fileContent, fileName, isParsing, parseError } = useApp()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [fileContent])

  const highlighted = useMemo(() => {
    if (!fileContent) return ''
    return highlightXml(formatXml(fileContent))
  }, [fileContent])

  if (isParsing) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='flex items-center gap-2'>
          <span className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          <span className='text-sm text-muted-foreground'>Parsing...</span>
        </div>
      </div>
    )
  }

  if (parseError) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <p className='text-sm font-medium text-destructive'>Parse Error</p>
          <p className='mt-1 text-xs text-muted-foreground'>{parseError}</p>
        </div>
      </div>
    )
  }

  if (!fileContent) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <svg
            width='40'
            height='40'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='1'
            className='mx-auto mb-3 text-muted-foreground/40'
          >
            <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
            <polyline points='14 2 14 8 20 8' />
            <line x1='16' y1='13' x2='8' y2='13' />
            <line x1='16' y1='17' x2='8' y2='17' />
          </svg>
          <p className='text-sm text-muted-foreground'>XML Preview</p>
          <p className='mt-1 text-xs text-muted-foreground/60'>Load an XML or GPX file to preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex items-center gap-2 border-b border-border px-3 py-1.5'>
        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='text-muted-foreground'>
          <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
          <polyline points='14 2 14 8 20 8' />
        </svg>
        <span className='text-xs font-medium text-foreground'>{fileName}</span>
      </div>
      <div
        ref={scrollRef}
        className='flex-1 overflow-auto p-3'
      >
        <pre
          className='font-mono text-xs leading-relaxed whitespace-pre'
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>
    </div>
  )
}
