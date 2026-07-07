import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { FileResult, RecentFile, McpStatus, JsonSummary } from '../shared/types'

const electronAPI = {
  getPathForFile: (file: File): string | null => webUtils.getPathForFile(file),
  openFile: (): Promise<FileResult | null> => ipcRenderer.invoke('open-file'),

  readFile: (path: string): Promise<FileResult | null> => ipcRenderer.invoke('read-file', path),

  fetchUrl: (url: string): Promise<FileResult | null> =>
    ipcRenderer.invoke('fetch-url', url),

  streamFile: (filePath: string): Promise<{ name: string; size: number; success: boolean; error?: string }> =>
    ipcRenderer.invoke('stream-file', filePath),

  readXmlFile: (path: string): Promise<string | null> =>
    ipcRenderer.invoke('read-xml-file', path),

  readJsonFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('read-json-file', filePath),

  getJsonSummary: (): Promise<JsonSummary> =>
    ipcRenderer.invoke('get-json-summary'),

  jsonQuery: (path: string): Promise<string | null> =>
    ipcRenderer.invoke('json-query', path),

  readJsonChunk: (start: number, length: number): Promise<string | null> =>
    ipcRenderer.invoke('json-read-chunk', start, length),

  getIndexTree: <T = unknown>() => ipcRenderer.invoke('get-index-tree') as Promise<T>,

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

  startMcpServer: (port: number): Promise<{ port: number }> =>
    ipcRenderer.invoke('start-mcp-server', port),

  stopMcpServer: (): Promise<void> => ipcRenderer.invoke('stop-mcp-server'),

  getMcpStatus: (): Promise<McpStatus> => ipcRenderer.invoke('get-mcp-status'),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  detectEditors: (): Promise<string | null> => ipcRenderer.invoke('detect-editors'),

  openInEditor: (content: string): Promise<boolean> => ipcRenderer.invoke('open-in-editor', content),

  on: (channel: string, cb: (...args: unknown[]) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, ...args: unknown[]) => cb(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', electronAPI)
