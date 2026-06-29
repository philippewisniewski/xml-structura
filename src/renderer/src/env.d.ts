/// <reference types="vite/client" />

interface Window {
  api: {
    openFile: () => Promise<{ content: string; name: string; path: string; size: number } | null>
    readFile: (path: string) => Promise<{ content: string; name: string; size: number } | null>
    fetchUrl: (url: string) => Promise<{ content: string; name: string; size: number } | null>
    parseXml: (content: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
    parseGpx: (content: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
    getFileInfo: (content: string) => Promise<{ size: number; lines: number }>
    saveFile: (content: string, defaultName: string) => Promise<boolean>
    getRecentFiles: () => Promise<RecentFile[]>
    addRecentFile: (file: RecentFile) => Promise<void>
    clearRecentFiles: () => Promise<void>
    startMcpServer: (port: number, data: unknown) => Promise<{ port: number }>
    stopMcpServer: () => Promise<void>
    getMcpStatus: () => Promise<{ running: boolean; port: number | null }>
    getAppVersion: () => Promise<string>
    detectEditors: () => Promise<string | null>
    openInEditor: (content: string) => Promise<boolean>
  }
}

interface RecentFile {
  name: string
  path: string
  timestamp: number
}
