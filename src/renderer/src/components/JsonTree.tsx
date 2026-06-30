import { useState, useCallback, useEffect } from 'react'
import { useApp } from '../App'

const MAX_ARRAY_ITEMS = 50

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

interface JsonTreeNodeProps {
  keyName: string
  value: unknown
  path: string
  depth: number
}

function JsonTreeNode({ keyName, value, path, depth }: JsonTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [copied, setCopied] = useState(false)

  const isArray = Array.isArray(value)
  const isObject = !isArray && value !== null && typeof value === 'object'
  const isExpandable = isArray || isObject

  const entries = isObject
    ? Object.entries(value as Record<string, unknown>)
    : []

  const toggle = useCallback(() => {
    if (isExpandable) setExpanded(prev => !prev)
  }, [isExpandable])

  const handleCopyValue = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(JSON.stringify(value, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  const handleCopyPath = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(path)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [path])

  const arrLen = isArray ? (value as unknown[]).length : 0
  const typeInfo = isArray
    ? `[${arrLen}]`
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
        {isExpandable ? (
          <span className='w-3.5 shrink-0 text-center text-[10px] text-muted-foreground leading-4'>
            {expanded ? '▼' : '▶'}
          </span>
        ) : (
          <span className='w-3.5 shrink-0' />
        )}
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
          {isArray && (value as unknown[]).slice(0, MAX_ARRAY_ITEMS).map((item, i) => {
            const itemPath = `${path}[${i}]`
            return (
              <JsonTreeNode
                key={i}
                keyName={`[${i}]`}
                value={item}
                path={itemPath}
                depth={depth + 1}
              />
            )
          })}
          {isArray && arrLen > MAX_ARRAY_ITEMS && (
            <div className='text-[10px] text-muted-foreground px-1 py-[1px]'>
              … {arrLen - MAX_ARRAY_ITEMS} more items
            </div>
          )}
          {isObject && entries.map(([key, val]) => (
            <JsonTreeNode
              key={key}
              keyName={key}
              value={val}
              path={`${path}.${key}`}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* Structural tree for large files — built from index paths, no data loading */

function ScalarNode({ node }: { node: IndexTreeNode }) {
  const [value, setValue] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.api.jsonQuery(node.path).then(result => {
      if (result !== null) {
        try { setValue(JSON.parse(result)) } catch { setValue(result) }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [node.path])

  const handleCopyPath = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(node.path)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [node.path])

  return (
    <div
      className='group flex items-start gap-0 rounded-sm px-1 py-[1px] hover:bg-accent/50'
    >
      <span className='w-3.5 shrink-0' />
      <span className='text-xs text-foreground'>{node.name}</span>
      <span className='mx-1 text-muted-foreground'>:</span>
      {loading ? (
        <span className='text-[10px] text-muted-foreground'>…</span>
      ) : (
        <ValueDisplay value={value} />
      )}
      {copied && <span className='ml-2 text-[10px] text-green-500'>Copied!</span>}
      <div className='ml-auto hidden gap-1 group-hover:flex'>
        <button
          onClick={handleCopyPath}
          className='rounded px-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent'
        >
          path
        </button>
      </div>
    </div>
  )
}

function StructuralNode({ node, depth }: { node: IndexTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [copied, setCopied] = useState(false)

  const toggle = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  const handleCopyPath = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(node.path)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [node.path])

  const typeLabel = node.nodeType === 'object'
    ? `{${node.childCount}}`
    : node.nodeType === 'array'
      ? `[${node.childCount}]`
      : null

  return (
    <div>
      <div
        className={`group flex items-start gap-0 rounded-sm px-1 py-[1px] hover:bg-accent/50 cursor-pointer ${
          depth === 0 ? 'font-semibold' : ''
        }`}
        onClick={node.nodeType !== 'scalar' ? toggle : undefined}
      >
        <span className='w-3.5 shrink-0 text-center text-[10px] text-muted-foreground leading-4'>
          {expanded ? '▼' : '▶'}
        </span>
        <span className='text-xs text-foreground'>{node.name}</span>
        {typeLabel && (
          <span className='ml-1 text-[10px] text-muted-foreground'>{typeLabel}</span>
        )}
        {copied && <span className='ml-2 text-[10px] text-green-500'>Copied!</span>}
        <div className='ml-auto hidden gap-1 group-hover:flex'>
          <button
            onClick={handleCopyPath}
            className='rounded px-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent'
          >
            path
          </button>
        </div>
      </div>
      {expanded && node.nodeType === 'object' && (
        <div className='border-l border-border ml-[7px] pl-2'>
          {node.children.map(child =>
            child.nodeType === 'scalar'
              ? <ScalarNode key={child.path} node={child} />
              : <StructuralNode key={child.path} node={child} depth={depth + 1} />
          )}
        </div>
      )}
      {expanded && node.nodeType === 'array' && (
        <div className='border-l border-border ml-[7px] pl-2'>
          {node.children.map(child =>
            child.nodeType === 'scalar'
              ? <ScalarNode key={child.path} node={child} />
              : <StructuralNode key={child.path} node={child} depth={depth + 1} />
          )}
        </div>
      )}
    </div>
  )
}

function LargeFileTree() {
  const [tree, setTree] = useState<IndexTreeNode | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.getIndexTree<IndexTreeNode>().then(t => {
      setTree(t)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  if (!loaded) {
    return <div className='text-xs text-muted-foreground p-3'>Building index tree…</div>
  }

  if (!tree || tree.children.length === 0) {
    return <div className='text-xs text-muted-foreground p-3'>No data in index</div>
  }

  return (
    <div>
      {tree.children.map(child =>
        child.nodeType === 'scalar'
          ? <ScalarNode key={child.path} node={child} />
          : <StructuralNode key={child.path} node={child} depth={0} />
      )}
    </div>
  )
}

export function JsonTree() {
  const { parsedData, isLargeFile } = useApp()

  if (isLargeFile) {
    return <LargeFileTree />
  }

  if (!parsedData) {
    return <div className='text-xs text-muted-foreground'>No data available</div>
  }

  return (
    <div>
      {typeof parsedData === 'object' && parsedData !== null
        ? Object.entries(parsedData as Record<string, unknown>).map(([key, val]) => (
            <JsonTreeNode
              key={key}
              keyName={key}
              value={val}
              path={key}
              depth={0}
            />
          ))
        : (
          <JsonTreeNode
            keyName='root'
            value={parsedData}
            path='root'
            depth={0}
          />
        )}
    </div>
  )
}
