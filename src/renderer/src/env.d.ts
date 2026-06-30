/// <reference types="vite/client" />

interface JsonSummary {
  fileSize: number
  isLarge: boolean
  topLevelKeys: string[]
  parsedData: unknown
  preview: string
}

interface Window {
  api: {
    getPathForFile: (file: File) => string | null
    openFile: () => Promise<{ name: string; path?: string; size: number } | null>
    readFile: (path: string) => Promise<{ name: string; size: number } | null>
    fetchUrl: (url: string) => Promise<{ name: string; path?: string; size: number } | null>
    streamFile: (filePath: string) => Promise<{ name: string; size: number; success: boolean; error?: string }>
    readJsonFile: (filePath: string) => Promise<string | null>
    getJsonSummary: () => Promise<JsonSummary>
    jsonQuery: (path: string) => Promise<string | null>
    readJsonChunk: (start: number, length: number) => Promise<string | null>
    getIndexTree: <T = unknown>() => Promise<T>
    saveFile: (content: string, defaultName: string) => Promise<boolean>
    getRecentFiles: () => Promise<RecentFile[]>
    addRecentFile: (file: RecentFile) => Promise<void>
    clearRecentFiles: () => Promise<void>
    startMcpServer: (port: number) => Promise<{ port: number }>
    stopMcpServer: () => Promise<void>
    getMcpStatus: () => Promise<{ running: boolean; port: number | null }>
    getAppVersion: () => Promise<string>
    detectEditors: () => Promise<string | null>
    openInEditor: (content: string) => Promise<boolean>
    on: (channel: string, cb: (...args: unknown[]) => void) => () => void
    removeAllListeners: (channel: string) => void
  }
}

interface RecentFile {
  name: string
  path: string
  timestamp: number
}

interface ParseProgressData {
  bytesRead: number
  totalBytes: number
  phase: 'parsing'
}

interface IndexTreeNode {
  name: string
  path: string
  nodeType: 'object' | 'array' | 'scalar'
  children: IndexTreeNode[]
  childCount: number
}
