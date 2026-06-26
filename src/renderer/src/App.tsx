import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { PanelResizeHandle as ResizableHandle, Panel as ResizablePanel, PanelGroup as ResizablePanelGroup } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar'
import { InputPanel } from './components/InputPanel'
import { XmlPreview } from './components/XmlPreview'
import { JsonTree } from './components/JsonTree'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'
import type { RecentFile, ParserMode } from '@shared/types'

interface AppState {
  fileContent: string | null
  fileName: string | null
  filePath: string | null
  fileSize: number | null
  fileLines: number | null
  parsedData: unknown | null
  parseError: string | null
  isParsing: boolean
  parserMode: ParserMode
  recentFiles: RecentFile[]
  mcpRunning: boolean
  isSidebarOpen: boolean
}

interface AppContextType extends AppState {
  loadFile: (content: string, name: string, path?: string) => Promise<void>
  loadUrl: (url: string) => Promise<void>
  openFileDialog: () => Promise<void>
  setParserMode: (mode: ParserMode) => void
  clearFile: () => void
  clearRecentFiles: () => Promise<void>
  toggleSidebar: () => void
  toggleTheme: () => void
  theme: 'light' | 'dark'
  copyJson: () => Promise<void>
  downloadJson: () => Promise<void>
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
  const [parserMode, setParserMode] = useState<ParserMode>('xml')
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [mcpRunning, setMcpRunning] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

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
    if (parsedData && !parseError) {
      window.api.startMcpServer(4283, parsedData).then(setMcpRunning)
    } else {
      window.api.stopMcpServer().then(() => setMcpRunning(false))
    }

    return () => {
      window.api.stopMcpServer()
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

      const isGpx = name.toLowerCase().endsWith('.gpx') || parserMode === 'gpx'

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
    [parserMode]
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
    parserMode,
    recentFiles,
    mcpRunning,
    isSidebarOpen,
    loadFile,
    loadUrl,
    openFileDialog,
    setParserMode,
    clearFile,
    clearRecentFiles: clearRecentFilesFn,
    toggleSidebar,
    toggleTheme,
    theme,
    copyJson,
    downloadJson
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className='flex h-screen flex-col overflow-hidden bg-background'>
        <Toolbar />
        <div className='flex flex-1 overflow-hidden'>
          {isSidebarOpen && <Sidebar />}
          <ResizablePanelGroup direction='horizontal' className='flex-1'>
            <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
              <InputPanel />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={41} minSize={25}>
              <XmlPreview />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={41} minSize={25}>
              <JsonTree />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <StatusBar />
      </div>
    </AppContext.Provider>
  )
}

export default App
