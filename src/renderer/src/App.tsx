import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { PanelResizeHandle as ResizableHandle, Panel as ResizablePanel, PanelGroup as ResizablePanelGroup } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar'
import { XmlPreview } from './components/XmlPreview'
import { JsonPanel } from './components/JsonPanel'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'
import type { RecentFile } from '@shared/types'

interface AppState {
  fileContent: string | null
  fileName: string | null
  filePath: string | null
  fileSize: number | null
  fileLines: number | null
  parsedData: unknown | null
  parseError: string | null
  isParsing: boolean
  recentFiles: RecentFile[]
  mcpRunning: boolean
  mcpPort: number | null
  isSidebarOpen: boolean
  viewMode: 'tree' | 'raw'
  editorName: string | null
}

interface AppContextType extends AppState {
  loadFile: (content: string, name: string, path?: string) => Promise<void>
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
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [fileLines, setFileLines] = useState<number | null>(null)
  const [parsedData, setParsedData] = useState<unknown | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [mcpRunning, setMcpRunning] = useState(false)
  const [mcpPort, setMcpPort] = useState<number | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree')
  const [editorName, setEditorName] = useState<string | null>(null)

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
    if (parsedData && !parseError) {
      window.api.startMcpServer(4283, parsedData).then(result => {
        setMcpRunning(true)
        setMcpPort(result.port)
      })
    } else {
      window.api.stopMcpServer().then(() => {
        setMcpRunning(false)
        setMcpPort(null)
      })
    }

    return () => {
      window.api.stopMcpServer().then(() => {
        setMcpRunning(false)
        setMcpPort(null)
      })
    }
  }, [parsedData, parseError])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return next
    })
  }, [])

  const parseContent = useCallback(
    async (content: string, name: string, path?: string) => {
      setFileContent(content)
      setNameAndSize(content, name, path)
      setIsParsing(true)
      setParseError(null)
      setParsedData(null)

      const isGpx = name.toLowerCase().endsWith('.gpx')

      try {
        const result = isGpx
          ? await window.api.parseGpx(content)
          : await window.api.parseXml(content)

        if (result.success) {
          setParsedData(result.data)
        } else {
          setParseError(result.error || 'Parse failed')
        }
      } catch (err) {
        setParseError((err as Error).message)
      } finally {
        setIsParsing(false)
      }
    },
    []
  )

  async function setNameAndSize(content: string, name: string, path?: string) {
    setFileName(name)
    setFilePath(path || null)
    const info = await window.api.getFileInfo(content)
    setFileSize(info.size)
    setFileLines(info.lines)
  }

  const loadFile = useCallback(
    async (content: string, name: string, path?: string) => {
      await parseContent(content, name, path)
      const file: RecentFile = { name, path: path || name, timestamp: Date.now() }
      await window.api.addRecentFile(file)
      const files = await window.api.getRecentFiles()
      setRecentFiles(files)
    },
    [parseContent]
  )

  const loadUrl = useCallback(
    async (url: string) => {
      try {
        setIsParsing(true)
        setParseError(null)
        const result = await window.api.fetchUrl(url)
        if (result) {
          await parseContent(result.content, result.name)
          const file: RecentFile = { name: result.name, path: url, timestamp: Date.now() }
          await window.api.addRecentFile(file)
          const files = await window.api.getRecentFiles()
          setRecentFiles(files)
        } else {
          setParseError('Failed to fetch URL')
        }
      } catch (err) {
        setParseError((err as Error).message)
      } finally {
        setIsParsing(false)
      }
    },
    [parseContent]
  )

  const openFileDialog = useCallback(async () => {
    const result = await window.api.openFile()
    if (result) {
      await loadFile(result.content, result.name, result.path)
    }
  }, [loadFile])

  const clearFile = useCallback(() => {
    setFileContent(null)
    setFileName(null)
    setFilePath(null)
    setFileSize(null)
    setFileLines(null)
    setParsedData(null)
    setParseError(null)
  }, [])

  const handleOpenInEditor = useCallback(async () => {
    if (!parsedData) return
    const content = JSON.stringify(parsedData, null, 2)
    await window.api.openInEditor(content)
  }, [parsedData])

  const clearRecentFilesFn = useCallback(async () => {
    await window.api.clearRecentFiles()
    setRecentFiles([])
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  const copyJson = useCallback(async () => {
    if (!parsedData) return
    const text = JSON.stringify(parsedData, null, 2)
    await navigator.clipboard.writeText(text)
  }, [parsedData])

  const downloadJson = useCallback(async () => {
    if (!parsedData) return
    const text = JSON.stringify(parsedData, null, 2)
    const defaultName = (fileName || 'output').replace(/\.(xml|gpx)$/i, '.json')
    await window.api.saveFile(text, defaultName)
  }, [parsedData, fileName])

  const ctx: AppContextType = {
    fileContent,
    fileName,
    filePath,
    fileSize,
    fileLines,
    parsedData,
    parseError,
    isParsing,
    recentFiles,
    mcpRunning,
    mcpPort,
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
              {parsedData !== null && <span className='text-green-500'>✓ Parsed</span>}
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
                disabled={!editorName || !parsedData}
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
