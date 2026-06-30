import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import { PanelResizeHandle as ResizableHandle, Panel as ResizablePanel, PanelGroup as ResizablePanelGroup } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar'
import { XmlPreview } from './components/XmlPreview'
import { JsonPanel } from './components/JsonPanel'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'
import type { RecentFile, JsonSummary } from '@shared/types'

interface AppState {
  fileName: string | null
  filePath: string | null
  fileSize: number | null
  fileLines: number | null
  isParsing: boolean
  parseProgress: { bytesRead: number; totalBytes: number; phase: 'parsing' } | null
  parseError: string | null
  isParsed: boolean
  isLargeFile: boolean
  jsonSummary: JsonSummary | null
  parsedData: unknown | null
  jsonContent: string | null
  recentFiles: RecentFile[]
  mcpRunning: boolean
  mcpPort: number | null
  mcpError: string | null
  isSidebarOpen: boolean
  viewMode: 'tree' | 'raw'
  editorName: string | null
}

interface AppContextType extends AppState {
  loadFile: (filePath: string) => Promise<void>
  loadUrl: (url: string) => Promise<void>
  openFileDialog: () => Promise<void>
  clearFile: () => void
  clearRecentFiles: () => Promise<void>
  toggleSidebar: () => void
  toggleTheme: () => void
  setViewMode: (mode: 'tree' | 'raw') => void
  theme: 'light' | 'dark'
  copyJson: () => Promise<void>
  downloadJson: () => Promise<void>
  handleOpenInEditor: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function useApp(): AppContextType {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

function App() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [fileLines, setFileLines] = useState<number | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState<{ bytesRead: number; totalBytes: number; phase: 'parsing' } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsed, setIsParsed] = useState(false)
  const [isLargeFile, setIsLargeFile] = useState(false)
  const [jsonSummary, setJsonSummary] = useState<JsonSummary | null>(null)
  const [parsedData, setParsedData] = useState<unknown | null>(null)
  const [jsonContent, setJsonContent] = useState<string | null>(null)
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [mcpRunning, setMcpRunning] = useState(false)
  const [mcpPort, setMcpPort] = useState<number | null>(null)
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree')
  const [editorName, setEditorName] = useState<string | null>(null)
  const cleanupRef = useRef<Array<() => void>>([])

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark')
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    window.api.getRecentFiles().then(setRecentFiles)
  }, [])

  useEffect(() => {
    window.api.detectEditors().then(setEditorName)
  }, [])

  useEffect(() => {
    if (isParsed && !parseError) {
      setMcpError(null)
      window.api.startMcpServer(4283).then(result => {
        setMcpRunning(true)
        setMcpPort(result.port)
        setMcpError(null)
      }).catch(err => {
        setMcpError(String(err))
        setMcpRunning(false)
        setMcpPort(null)
      })
    } else {
      window.api.stopMcpServer().then(() => {
        setMcpRunning(false)
        setMcpPort(null)
        setMcpError(null)
      })
    }

    return () => {
      window.api.stopMcpServer().then(() => {
        setMcpRunning(false)
        setMcpPort(null)
        setMcpError(null)
      })
    }
  }, [isParsed, parseError])

  const cleanup = useCallback(() => {
    for (const fn of cleanupRef.current) fn()
    cleanupRef.current = []
  }, [])

  const startStream = useCallback(async (path: string, name: string, displayPath?: string) => {
    cleanup()
    setIsParsing(true)
    setIsParsed(false)
    setIsLargeFile(false)
    setJsonSummary(null)
    setParseError(null)
    setParseProgress(null)
    setParsedData(null)
    setJsonContent(null)
    setFileName(name)
    setFilePath(displayPath || path)
    setFileSize(null)
    setFileLines(null)
    setMcpError(null)

    const unsubProgress = window.api.on('parse-progress', (data: unknown) => {
      const d = data as { bytesRead: number; totalBytes: number; phase: 'parsing' }
      setParseProgress(d)
    })
    const unsubComplete = window.api.on('parse-complete', async (result: unknown) => {
      const { filePath, size } = result as { filePath: string; size: number }
      if (size) setFileSize(size)

      const summary = await window.api.getJsonSummary()
      setJsonSummary(summary)

      if (summary.isLarge) {
        setIsLargeFile(true)
        if (summary.parsedData) {
          setParsedData(summary.parsedData)
        }
      } else {
        setIsLargeFile(false)
        const json = await window.api.readJsonFile(filePath)
        if (json) {
          setParsedData(JSON.parse(json))
          setJsonContent(json)
        }
      }
      setIsParsing(false)
      setIsParsed(true)
    })
    const unsubError = window.api.on('parse-error', (err: unknown) => {
      setIsParsing(false)
      setParseError(String(err))
    })
    cleanupRef.current = [unsubProgress, unsubComplete, unsubError]

    try {
      const result = await window.api.streamFile(path)
      if (!result.success) {
        setIsParsing(false)
        setParseError(result.error || 'Parse failed')
      }
    } catch (err) {
      setIsParsing(false)
      setParseError((err as Error).message)
    }
  }, [cleanup])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return next
    })
  }, [])

  const loadFile = useCallback(
    async (filePathInput: string) => {
      const name = filePathInput.split('/').pop() || filePathInput.split('\\').pop() || 'unknown'
      const file: RecentFile = { name, path: filePathInput, timestamp: Date.now() }
      await window.api.addRecentFile(file)
      const files = await window.api.getRecentFiles()
      setRecentFiles(files)
      await startStream(filePathInput, name, filePathInput)
    },
    [startStream]
  )

  const loadUrl = useCallback(
    async (url: string) => {
      try {
        setIsParsing(true)
        setParseError(null)
        const result = await window.api.fetchUrl(url)
        if (result && result.path) {
          await startStream(result.path, result.name)
          const file: RecentFile = { name: result.name, path: url, timestamp: Date.now() }
          await window.api.addRecentFile(file)
          const files = await window.api.getRecentFiles()
          setRecentFiles(files)
        } else {
          throw new Error('Failed to fetch URL')
        }
      } catch (err) {
        const msg = (err as Error).message
        setIsParsing(false)
        setParseError(msg)
        throw new Error(msg)
      }
    },
    [startStream]
  )

  const openFileDialog = useCallback(async () => {
    const result = await window.api.openFile()
    if (result && result.path) {
      await startStream(result.path, result.name, result.path)
      const file: RecentFile = { name: result.name, path: result.path, timestamp: Date.now() }
      await window.api.addRecentFile(file)
      const files = await window.api.getRecentFiles()
      setRecentFiles(files)
    }
  }, [startStream])

  const clearFile = useCallback(() => {
    cleanup()
    setFileName(null)
    setFilePath(null)
    setFileSize(null)
    setFileLines(null)
    setIsParsing(false)
    setIsParsed(false)
    setIsLargeFile(false)
    setJsonSummary(null)
    setParseError(null)
    setParseProgress(null)
    setParsedData(null)
    setJsonContent(null)
    setMcpError(null)
    window.api.stopMcpServer().then(() => {
      setMcpRunning(false)
      setMcpPort(null)
    })
  }, [cleanup])

  const handleOpenInEditor = useCallback(async () => {
    if (!jsonContent) return
    await window.api.openInEditor(jsonContent)
  }, [jsonContent])

  const clearRecentFilesFn = useCallback(async () => {
    await window.api.clearRecentFiles()
    setRecentFiles([])
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  const copyJson = useCallback(async () => {
    if (!jsonContent) return
    await navigator.clipboard.writeText(jsonContent)
  }, [jsonContent])

  const downloadJson = useCallback(async () => {
    if (!jsonContent) return
    const defaultName = (fileName || 'output').replace(/\.(xml|gpx)$/i, '.json')
    await window.api.saveFile(jsonContent, defaultName)
  }, [jsonContent, fileName])

  const progress = parseProgress
  const percent = progress && progress.totalBytes > 0
    ? Math.round((progress.bytesRead / progress.totalBytes) * 100)
    : 0

  const ctx: AppContextType = {
    fileName,
    filePath,
    fileSize,
    fileLines,
    isParsing,
    parseProgress,
    parseError,
    isParsed,
    isLargeFile,
    jsonSummary,
    parsedData,
    jsonContent,
    recentFiles,
    mcpRunning,
    mcpPort,
    mcpError,
    isSidebarOpen,
    viewMode,
    editorName,
    loadFile,
    loadUrl,
    openFileDialog,
    clearFile,
    clearRecentFiles: clearRecentFilesFn,
    toggleSidebar,
    toggleTheme,
    setViewMode,
    theme,
    copyJson,
    downloadJson,
    handleOpenInEditor
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className='flex h-screen flex-col overflow-hidden bg-background'>
        <Toolbar />
        <div className='flex flex-1 overflow-hidden'>
          {isSidebarOpen && <Sidebar />}
          <div className='flex flex-1 flex-col overflow-hidden'>

          {/* Info + actions row */}
          <div className='flex h-7 items-center justify-between border-b border-border px-3'>
            <div className='flex items-center gap-2 text-[11px] text-muted-foreground'>
              {fileName && <span>Loaded {fileName}</span>}
              {fileSize !== null && (
                <span>
                  {fileSize >= 1024 * 1024
                    ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
                    : fileSize >= 1024
                      ? `${(fileSize / 1024).toFixed(1)} KB`
                      : `${fileSize} B`}
                </span>
              )}
              {fileLines !== null && <span>{fileLines.toLocaleString()} lines</span>}
              {isParsing && progress && (
                <span className='flex items-center gap-1'>
                  <span className='h-2 w-2 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent' />
                  Parsing {percent}%
                </span>
              )}
              {isParsed && <span className='text-green-500'>✓ Parsed</span>}
              {isParsed && isLargeFile && <span className='text-muted-foreground'>— Structure view (index)</span>}
              {parseError !== null && <span className='text-destructive'>✗ Error</span>}
            </div>
            <div className='flex items-center gap-1'>
              <button
                onClick={() => setViewMode('tree')}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                Tree
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'raw'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                Raw
              </button>
              <button
                onClick={copyJson}
                className='flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
                title='Copy JSON'
              >
                <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                  <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                </svg>
              </button>
              <button
                onClick={downloadJson}
                className='flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
                title='Download JSON'
              >
                <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                  <polyline points='7 10 12 15 17 10' />
                  <line x1='12' y1='15' x2='12' y2='3' />
                </svg>
              </button>
              <button
                onClick={handleOpenInEditor}
                disabled={!editorName || !isParsed}
                className='rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                title={
                  editorName
                    ? `Open in ${editorName}`
                    : 'No editor detected (install VS Code, Cursor, or Zed)'
                }
              >
                {editorName ? `Open in ${editorName}` : 'Open in Editor'}
              </button>
            </div>
          </div>

          <div className='flex flex-1 overflow-hidden'>
            <ResizablePanelGroup direction='horizontal' className='flex-1'>
              <ResizablePanel defaultSize={50} minSize={25}>
                <XmlPreview />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={50} minSize={25}>
                <JsonPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          <StatusBar />
          </div>
        </div>
      </div>
    </AppContext.Provider>
  )
}

export default App
