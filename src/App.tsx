import { useEffect, useCallback, useRef } from 'react'
import { useParser } from './hooks/useParser'
import { Toolbar } from './components/Toolbar'
import { Sidebar } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { DropZone } from './components/DropZone'
import { TreeView } from './views/TreeView'
import { JsonView, treeToObject } from './views/JsonView'
import { ResizableHandle } from './components/ResizableHandle'
import { getFileHandle, storeFileHandle } from './hooks/use-recent-files'

const FILE_EXT_RE = /\.(xml|gpx|svg|rss|atom|xhtml)$/i

export default function App() {
  const { state, dispatch, handleFile } = useParser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
    document.documentElement.classList.toggle('light', state.theme === 'light')
  }, [state.theme])

  const onOpenFile = useCallback(async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'XML Files',
            accept: { 'text/xml': ['.xml', '.gpx', '.svg', '.rss', '.atom', '.xhtml'] }
          }],
          multiple: false
        })
        const file = await handle.getFile()
        if (file.name.match(FILE_EXT_RE)) {
          storeFileHandle(file.name, handle)
          handleFile(file)
        }
      } catch {}
    } else {
      fileInputRef.current?.click()
    }
  }, [handleFile])

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.match(FILE_EXT_RE)) {
      handleFile(file)
    }
    if (e.target) e.target.value = ''
  }, [handleFile])

  const handleRecentFile = useCallback(async (name: string) => {
    const handle = getFileHandle(name)
    if (handle) {
      try {
        const file = await handle.getFile()
        if (file.name.match(FILE_EXT_RE)) {
          handleFile(file)
          return
        }
      } catch {}
    }
    fileInputRef.current?.click()
  }, [handleFile])

  const onCopy = useCallback(() => {
    if (!state.tree) return
    navigator.clipboard.writeText(JSON.stringify(treeToObject(state.tree), null, 2)).catch(() => {})
  }, [state.tree])

  const onDownload = useCallback(() => {
    if (!state.tree || !state.file) return
    const json = JSON.stringify(treeToObject(state.tree), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = state.file.name.replace(FILE_EXT_RE, '.json')
    a.click()
    URL.revokeObjectURL(url)
  }, [state.tree, state.file])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-gray-100 font-mono text-sm">
      <Toolbar
        onOpenFile={onOpenFile}
        onCopy={onCopy}
        onDownload={onDownload}
        onThemeToggle={() => dispatch({ type: 'TOGGLE_THEME' })}
        onSidebarToggle={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        theme={state.theme}
        fileName={state.file?.name ?? ''}
        hasResult={state.status === 'done'}
      />
      <div className="flex flex-1 min-h-0">
        {state.sidebarOpen && (
          <Sidebar recentFiles={state.recentFiles} onSelect={handleRecentFile} />
        )}
        <div className="flex flex-1 min-w-0">
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {state.tree ? (
              <TreeView tree={state.tree} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                Load an XML file to view its structure
              </div>
            )}
          </div>
          <ResizableHandle />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {state.tree ? (
              <JsonView tree={state.tree} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                Load an XML file to view its structure
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar
        status={state.status}
        progress={state.progress}
        error={state.error}
        fileName={state.file?.name ?? ''}
        gpxMetrics={state.gpxMetrics}
      />
      <DropZone onFile={handleFile} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,.gpx,.svg,.rss,.atom,.xhtml"
        className="hidden"
        onChange={onFileInputChange}
      />
    </div>
  )
}
