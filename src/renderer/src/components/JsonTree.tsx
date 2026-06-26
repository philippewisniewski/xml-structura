import { useState, useCallback } from 'react'
import { useApp } from '../App'

interface TreeNodeProps {
  keyName: string
  value: unknown
  path: string
  depth: number
  defaultExpanded?: boolean
}

function ValueDisplay({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className='text-gray-400 dark:text-gray-500'>null</span>
  }
  if (typeof value === 'string') {
    return <span className='text-green-600 dark:text-green-400'>"{value}"</span>
  }
  if (typeof value === 'number') {
    return <span className='text-blue-600 dark:text-blue-400'>{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span className='text-orange-500 dark:text-orange-400'>{String(value)}</span>
  }
  return <span>{String(value)}</span>
}

function TreeNode({ keyName, value, path, depth, defaultExpanded }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? depth < 2)
  const [copied, setCopied] = useState(false)

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isExpandable = isObject || isArray

  const entries = isObject
    ? Object.entries(value as Record<string, unknown>)
    : isArray
      ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
      : []

  const toggle = useCallback(() => {
    if (isExpandable) setExpanded(prev => !prev)
  }, [isExpandable])

  const handleCopyPath = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    },
    [path]
  )

  const handleCopyValue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const text = JSON.stringify(value, null, 2)
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    },
    [value]
  )

  const typeInfo = isArray
    ? `[${entries.length}]`
    : isObject
      ? `{${entries.length}}`
      : null

  return (
    <div>
      <div
        className={`group flex items-start gap-0.5 rounded-sm px-1 py-[1px] hover:bg-accent/50 cursor-pointer ${
          depth === 0 ? 'font-semibold' : ''
        }`}
        onClick={toggle}
      >
        {isExpandable && (
          <span className='w-4 shrink-0 text-center text-[10px] text-muted-foreground'>
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!isExpandable && <span className='w-4 shrink-0' />}
        <span className='text-xs text-foreground'>{keyName}</span>
        {isExpandable && typeInfo && (
          <span className='ml-1 text-[10px] text-muted-foreground'>{typeInfo}</span>
        )}
        {!isExpandable && (
          <>
            <span className='mx-1 text-muted-foreground'>:</span>
            <ValueDisplay value={value} />
          </>
        )}
        {copied && (
          <span className='ml-2 text-[10px] text-green-500'>Copied!</span>
        )}
        <div className='ml-auto hidden gap-1 group-hover:flex'>
          {isExpandable && (
            <button
              onClick={handleCopyValue}
              className='rounded px-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent'
            >
              copy
            </button>
          )}
          <button
            onClick={handleCopyPath}
            className='rounded px-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent'
          >
            path
          </button>
        </div>
      </div>
      {isExpandable && expanded && (
        <div className='border-l border-border ml-[7px] pl-2'>
          {entries.map(([key, val]) => (
            <TreeNode
              key={key}
              keyName={isArray ? `[${key}]` : key}
              value={val}
              path={`${path}.${key}`}
              depth={depth + 1}
              defaultExpanded={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function JsonTree() {
  const { parsedData, isParsing, parseError, copyJson, downloadJson } = useApp()

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

  if (!parsedData) {
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
            <polyline points='4 17 10 11 4 5' />
            <line x1='12' y1='19' x2='20' y2='19' />
          </svg>
          <p className='text-sm text-muted-foreground'>JSON Output</p>
          <p className='mt-1 text-xs text-muted-foreground/60'>Parsed data will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex items-center justify-between border-b border-border px-3 py-1.5'>
        <span className='text-xs font-medium text-foreground'>JSON Tree</span>
        <div className='flex gap-1'>
          <button
            onClick={copyJson}
            className='rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
          >
            Copy
          </button>
          <button
            onClick={downloadJson}
            className='rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
          >
            Download
          </button>
        </div>
      </div>
      <div className='flex-1 overflow-auto p-3'>
        <TreeNode
          keyName='root'
          value={parsedData}
          path='$'
          depth={0}
          defaultExpanded={true}
        />
      </div>
    </div>
  )
}
