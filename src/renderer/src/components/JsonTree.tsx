import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useApp } from '../App'

const MAX_ARRAY_ITEMS = 50

// ---- Data Model ----

interface FlatRow {
  id: string
  depth: number
  keyName: string
  value: unknown
  path: string
  nodeType: 'object' | 'array' | 'scalar'
  childCount: number
  isExpanded: boolean
  parentPath: string | null
}

// ---- Value Display ----

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

// ---- Flatten Functions ----

function flattenTree(
  data: unknown,
  keyName: string,
  path: string,
  depth: number,
  expandedPaths: Set<string>
): FlatRow[] {
  const rows: FlatRow[] = []
  const isArray = Array.isArray(data)
  const isObj = !isArray && data !== null && typeof data === 'object'
  const isExpandable = isArray || isObj
  const childCount = isArray
    ? (data as unknown[]).length
    : isObj
      ? Object.keys(data as Record<string, unknown>).length
      : 0
  const isExpanded = expandedPaths.has(path)

  rows.push({
    id: path,
    depth,
    keyName,
    value: data,
    path,
    nodeType: isArray ? 'array' : isObj ? 'object' : 'scalar',
    childCount,
    isExpanded,
    parentPath: null,
  })

  if (isExpanded && isObj) {
    const entries = Object.entries(data as Record<string, unknown>)
    for (const [key, val] of entries) {
      const childPath = path + '.' + key
      rows.push(...flattenTree(val, key, childPath, depth + 1, expandedPaths))
    }
  }

  if (isExpanded && isArray) {
    const arr = data as unknown[]
    const display = arr.slice(0, MAX_ARRAY_ITEMS)
    for (let i = 0; i < display.length; i++) {
      const childPath = path + '[' + i + ']'
      rows.push(...flattenTree(display[i], '[' + i + ']', childPath, depth + 1, expandedPaths))
    }
    if (arr.length > MAX_ARRAY_ITEMS) {
      rows.push({
        id: path + '...more',
        depth: depth + 1,
        keyName: '… ' + (arr.length - MAX_ARRAY_ITEMS) + ' more items',
        value: undefined,
        path,
        nodeType: 'scalar',
        childCount: 0,
        isExpanded: false,
        parentPath: path,
      })
    }
  }

  return rows
}

function flattenStructuralTree(
  node: IndexTreeNode,
  depth: number,
  expandedPaths: Set<string>
): FlatRow[] {
  const rows: FlatRow[] = []
  const isExpanded = expandedPaths.has(node.path)
  const isExpandable = node.nodeType !== 'scalar'

  rows.push({
    id: node.path,
    depth,
    keyName: node.name,
    value: undefined,
    path: node.path,
    nodeType: node.nodeType,
    childCount: node.childCount,
    isExpanded,
    parentPath: null,
  })

  if (isExpanded && isExpandable && node.children) {
    for (const child of node.children) {
      rows.push(...flattenStructuralTree(child, depth + 1, expandedPaths))
    }
  }

  return rows
}

// ---- TreeRow Component ----

const TreeRow = memo(function TreeRow({
  row,
  style,
  onToggle,
  loadedValue,
  loadValue,
}: {
  row: FlatRow
  style: React.CSSProperties
  onToggle: (path: string) => void
  loadedValue?: unknown
  loadValue?: (path: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const isExpandable = row.nodeType !== 'scalar'
  const isMoreItemsRow = row.id.endsWith('...more')
  const displayValue = loadedValue !== undefined ? loadedValue : row.value
  const isLoading = loadValue !== undefined && row.nodeType === 'scalar' && displayValue === undefined && !isMoreItemsRow

  useEffect(() => {
    if (isLoading && loadValue) {
      loadValue(row.path)
    }
  }, [isLoading, loadValue, row.path])

  const handleToggle = useCallback(() => {
    if (isExpandable) onToggle(row.path)
  }, [isExpandable, onToggle, row.path])

  const handleCopyValue = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(JSON.stringify(row.value ?? loadedValue, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [row.value, loadedValue])

  const handleCopyPath = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(row.path)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [row.path])

  if (isMoreItemsRow) {
    return (
      <div style={style} className='leading-4'>
        <div
          className='px-1 py-[1px]'
          style={{ paddingLeft: `${row.depth * 16}px` }}
        >
          <span className='text-[10px] text-muted-foreground'>{row.keyName}</span>
        </div>
      </div>
    )
  }

  const typeInfo = row.nodeType === 'array'
    ? `[${row.childCount}]`
    : row.nodeType === 'object'
      ? `{${row.childCount}}`
      : null

  return (
    <div style={style} className='leading-4'>
      <div
        className={`group flex items-start gap-0 rounded-sm px-1 py-[1px] hover:bg-accent/50 ${
          isExpandable ? 'cursor-pointer' : ''
        } ${row.depth === 0 ? 'font-semibold' : ''}`}
        style={{ paddingLeft: `${row.depth * 16}px` }}
        onClick={isExpandable ? handleToggle : undefined}
      >
        {isExpandable ? (
          <span className='w-3.5 shrink-0 text-center text-[10px] text-muted-foreground leading-4'>
            {row.isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span className='w-3.5 shrink-0' />
        )}
        <span className='text-xs text-foreground'>{row.keyName}</span>
        {isExpandable && typeInfo && (
          <span className='ml-1 text-[10px] text-muted-foreground'>{typeInfo}</span>
        )}
        {!isExpandable && (
          <>
            <span className='mx-1 text-muted-foreground'>:</span>
            {isLoading ? (
              <span className='text-[10px] text-muted-foreground'>…</span>
            ) : (
              <ValueDisplay value={displayValue} />
            )}
          </>
        )}
        {copied && (
          <span className='ml-2 text-[10px] text-green-500'>Copied!</span>
        )}
        <div className='ml-auto hidden gap-1 group-hover:flex'>
          {isExpandable && row.value !== undefined && (
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
    </div>
  )
})

// ---- VirtualTree ----

function VirtualTree({
  rows,
  onToggle,
  loadedValues,
  loadValue,
}: {
  rows: FlatRow[]
  onToggle: (path: string) => void
  loadedValues?: Map<string, unknown>
  loadValue?: (path: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const [firstVisibleId, setFirstVisibleId] = useState<string | null>(null)

  useEffect(() => {
    if (!listRef.current) return
    let el = listRef.current.parentElement
    while (el) {
      const style = getComputedStyle(el)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        setScrollElement(el)
        return
      }
      el = el.parentElement
    }
  }, [])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 24,
    overscan: 5,
  })

  const handleToggle = useCallback((path: string) => {
    const items = virtualizer.getVirtualItems()
    if (items.length > 0) {
      const firstRow = rows[items[0].index]
      if (firstRow) setFirstVisibleId(firstRow.id)
    }
    onToggle(path)
  }, [virtualizer, rows, onToggle])

  useEffect(() => {
    if (firstVisibleId) {
      const idx = rows.findIndex((r) => r.id === firstVisibleId)
      if (idx !== -1) {
        virtualizer.scrollToIndex(idx, { align: 'start' })
      }
      setFirstVisibleId(null)
    }
  }, [rows, firstVisibleId, virtualizer])

  return (
    <div ref={listRef}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          return (
            <TreeRow
              key={row.id}
              row={row}
              style={{
                position: 'absolute',
                top: 0,
                transform: `translateY(${item.start}px)`,
                left: 0,
                right: 0,
              }}
              onToggle={handleToggle}
              loadedValue={loadedValues?.get(row.path)}
              loadValue={loadValue}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---- NormalJsonTree ----

function NormalJsonTree() {
  const { parsedData } = useApp()
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const set = new Set<string>()
    if (!parsedData) return set

    const initExpanded = (data: unknown, path: string, depth: number) => {
      if (depth >= 2) return
      const isArray = Array.isArray(data)
      const isObj = !isArray && data !== null && typeof data === 'object'
      if (isArray || isObj) {
        set.add(path)
        if (isObj) {
          const entries = Object.entries(data as Record<string, unknown>)
          for (const [key, val] of entries) {
            initExpanded(val, path + '.' + key, depth + 1)
          }
        }
        if (isArray) {
          const arr = data as unknown[]
          const display = arr.slice(0, MAX_ARRAY_ITEMS)
          for (let i = 0; i < display.length; i++) {
            initExpanded(display[i], path + '[' + i + ']', depth + 1)
          }
        }
      }
    }

    if (typeof parsedData === 'object' && parsedData !== null) {
      const entries = Object.entries(parsedData as Record<string, unknown>)
      for (const [key, val] of entries) {
        initExpanded(val, key, 0)
      }
    } else {
      initExpanded(parsedData, 'root', 0)
    }
    return set
  })

  const toggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const rows = useMemo(() => {
    if (!parsedData) return []
    if (typeof parsedData === 'object' && parsedData !== null) {
      const entries = Object.entries(parsedData as Record<string, unknown>)
      const result: FlatRow[] = []
      for (const [key, val] of entries) {
        result.push(...flattenTree(val, key, key, 0, expandedPaths))
      }
      return result
    }
    return flattenTree(parsedData, 'root', 'root', 0, expandedPaths)
  }, [parsedData, expandedPaths])

  if (!parsedData) {
    return <div className='text-xs text-muted-foreground'>No data available</div>
  }

  return <VirtualTree rows={rows} onToggle={toggle} />
}

// ---- LargeFileTree ----

function LargeFileTree() {
  const [tree, setTree] = useState<IndexTreeNode | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set())
  const [loadedValues, setLoadedValues] = useState<Map<string, unknown>>(new Map())
  const loadedValuesRef = useRef(loadedValues)
  loadedValuesRef.current = loadedValues

  useEffect(() => {
    window.api
      .getIndexTree<IndexTreeNode>()
      .then((t) => {
        setTree(t)
        if (t) {
          const set = new Set<string>()
          const initExpanded = (node: IndexTreeNode, depth: number) => {
            if (depth >= 2 || node.nodeType === 'scalar') return
            set.add(node.path)
            if (node.children) {
              for (const child of node.children) {
                initExpanded(child, depth + 1)
              }
            }
          }
          for (const child of t.children) {
            initExpanded(child, 0)
          }
          setExpandedPaths(set)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const toggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const loadValue = useCallback(async (path: string) => {
    if (loadedValuesRef.current.has(path)) return
    try {
      const result = await window.api.jsonQuery(path)
      if (result !== null) {
        let val: unknown
        try {
          val = JSON.parse(result as string)
        } catch {
          val = result
        }
        setLoadedValues((prev) => {
          const next = new Map(prev)
          next.set(path, val)
          return next
        })
      }
    } catch {
      // ignore query errors
    }
  }, [])

  const rows = useMemo(() => {
    if (!tree) return []
    const result: FlatRow[] = []
    for (const child of tree.children) {
      result.push(...flattenStructuralTree(child, 0, expandedPaths))
    }
    return result
  }, [tree, expandedPaths])

  if (!loaded) {
    return <div className='text-xs text-muted-foreground p-3'>Building index tree…</div>
  }

  if (!tree || tree.children.length === 0) {
    return <div className='text-xs text-muted-foreground p-3'>No data in index</div>
  }

  return (
    <VirtualTree
      rows={rows}
      onToggle={toggle}
      loadedValues={loadedValues}
      loadValue={loadValue}
    />
  )
}

// ---- JsonTree (Entry) ----

export function JsonTree() {
  const { parsedData, isLargeFile } = useApp()

  if (isLargeFile) {
    return <LargeFileTree />
  }

  if (!parsedData) {
    return <div className='text-xs text-muted-foreground'>No data available</div>
  }

  return <NormalJsonTree />
}
