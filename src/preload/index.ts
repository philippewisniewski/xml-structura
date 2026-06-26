import { contextBridge, ipcRenderer } from 'electron'
import type { FileResult, ParseResult, RecentFile, McpStatus } from '../shared/types'

const electronAPI = {
  openFile: (): Promise<FileResult | null> => ipcRenderer.invoke('open-file'),

  readFile: (path: string): Promise<FileResult | null> => ipcRenderer.invoke('read-file', path),

  fetchUrl: (url: string): Promise<FileResult | null> =>
    ipcRenderer.invoke('fetch-url', url),

  parseXml: (content: string): Promise<ParseResult> =>
    ipcRenderer.invoke('parse-xml', content),

  parseGpx: (content: string): Promise<ParseResult> =>
    ipcRenderer.invoke('parse-gpx', content),

  getFileInfo: (content: string): Promise<{ size: number; lines: number }> =>
    ipcRenderer.invoke('get-file-info', content),

  saveFile: (content: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('save-file', content, defaultName),

  getRecentFiles: (): Promise<RecentFile[]> => {
    const stored = localStorage.getItem('recent-files')
    return Promise.resolve(stored ? JSON.parse(stored) : [])
  },

  addRecentFile: (file: RecentFile): Promise<void> => {
    const stored = localStorage.getItem('recent-files')
    const files: RecentFile[] = stored ? JSON.parse(stored) : []
    const existing = files.findIndex(f => f.path === file.path)
    if (existing !== -1) files.splice(existing, 1)
    files.unshift(file)
    if (files.length > 20) files.length = 20
    localStorage.setItem('recent-files', JSON.stringify(files))
    return Promise.resolve()
  },

  clearRecentFiles: (): Promise<void> => {
    localStorage.removeItem('recent-files')
    return Promise.resolve()
  },

  startMcpServer: (port: number, data: unknown): Promise<boolean> =>
    ipcRenderer.invoke('start-mcp-server', port, data),

  stopMcpServer: (): Promise<void> => ipcRenderer.invoke('stop-mcp-server'),

  getMcpStatus: (): Promise<McpStatus> => ipcRenderer.invoke('get-mcp-status'),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version')
}

contextBridge.exposeInMainWorld('api', electronAPI)
