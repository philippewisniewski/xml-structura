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
    return <span className='text-purple-500 dark:text-purple-400'>null</span>
  }
  if (typeof value === 'string') {
    return <span className='text-emerald-600 dark:text-emerald-400'>"{value}"</span>
  }
  if (typeof value === 'number') {
    return <span className='text-amber-600 dark:text-amber-400'>{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span className='text-cyan-600 dark:text-cyan-400'>{String(value)}</span>
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
        className={`group flex items-start gap-0 rounded-sm px-1 py-[1px] hover:bg-accent/50 cursor-pointer ${
          depth === 0 ? 'font-semibold' : ''
        }`}
        onClick={toggle}
      >
        {isExpandable && (
          <span className='w-3.5 shrink-0 text-center text-[10px] text-muted-foreground leading-4'>
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!isExpandable && <span className='w-3.5 shrink-0' />}
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
  const { parsedData } = useApp()
  if (!parsedData) return null

  return (
    <TreeNode
      keyName='root'
      value={parsedData}
      path='$'
      depth={0}
      defaultExpanded={true}
    />
  )
}
