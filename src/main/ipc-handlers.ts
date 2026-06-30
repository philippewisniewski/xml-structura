import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync, spawn } from 'child_process'
import { DataStore } from './data-store'
import { parseStream } from './streaming-parser'
import { startMcpServer as mcpStart, stopMcpServer as mcpStop, getMcpStatus as mcpStatus } from './mcp-server'
import type { FileResult, McpStatus, ParseProgressData } from '../shared/types'

const tempFiles = new Set<string>()

app.on('will-quit', () => {
  for (const f of tempFiles) {
    try { unlinkSync(f) } catch { }
  }
  tempFiles.clear()
})

const EDITORS: Array<{ name: string; bins: string[] }> = [
  {
    name: 'VS Code',
    bins: [
      'code',
      '/usr/local/bin/code',
      '/opt/homebrew/bin/code',
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
    ]
  },
  {
    name: 'Cursor',
    bins: [
      'cursor',
      '/usr/local/bin/cursor',
      '/opt/homebrew/bin/cursor',
      '/Applications/Cursor.app/Contents/Resources/app/bin/cursor'
    ]
  },
  {
    name: 'Zed',
    bins: [
      'zed',
      '/usr/local/bin/zed',
      '/opt/homebrew/bin/zed',
      '/Applications/Zed.app/Contents/MacOS/zed'
    ]
  }
]

function findEditorPath(): { name: string; bin: string } | null {
  for (const { name, bins } of EDITORS) {
    for (const bin of bins) {
      if (bin.includes('/')) {
        if (existsSync(bin)) return { name, bin }
      } else {
        try {
          execFileSync('which', [bin], { encoding: 'utf-8' })
          return { name, bin }
        } catch { }
      }
    }
  }
  return null
}

export function registerIpcHandlers(): void {
  ipcMain.handle('open-file', async (): Promise<FileResult | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'XML/GPX', extensions: ['xml', 'gpx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const path = result.filePaths[0]
    const name = path.split('/').pop() || path.split('\\').pop() || 'unknown'
    return { name, path, size: 0 }
  })

  ipcMain.handle('read-file', async (_, path: string): Promise<FileResult | null> => {
    try {
      if (!existsSync(path)) return null
      const name = path.split('/').pop() || path.split('\\').pop() || 'unknown'
      return { name, size: 0 }
    } catch {
      return null
    }
  })

  ipcMain.handle('fetch-url', async (_, url: string): Promise<FileResult | null> => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const text = await response.text()
      const name = url.split('/').pop() || 'response.xml'

      const tmpFile = join(tmpdir(), `xml2json-url-${Date.now()}.xml`)
      writeFileSync(tmpFile, text, 'utf-8')
      tempFiles.add(tmpFile)

      return { name, path: tmpFile, size: Buffer.byteLength(text, 'utf-8') }
    } catch (err) {
      throw new Error(`Failed to fetch URL: ${(err as Error).message}`)
    }
  })

  ipcMain.handle('stream-file', async (event, filePath: string): Promise<{ name: string; size: number; success: boolean; error?: string }> => {
    const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown'
    const isGpx = name.toLowerCase().endsWith('.gpx')
    const win = BrowserWindow.fromWebContents(event.sender)

    return new Promise((resolve) => {
      parseStream(filePath, isGpx, {
        onProgress: (data: ParseProgressData) => {
          if (win && !win.isDestroyed()) {
            event.sender.send('parse-progress', data)
          }
        },
        onXmlChunk: (chunk: string) => {
          if (win && !win.isDestroyed()) {
            event.sender.send('xml-chunk', chunk)
          }
        },
        onComplete: (result: { filePath: string; name: string; size: number }) => {
          tempFiles.add(result.filePath)
          if (win && !win.isDestroyed()) {
            event.sender.send('parse-complete', result)
          }
          resolve({ name, size: result.size, success: true })
        },
        onError: (error: string) => {
          if (win && !win.isDestroyed()) {
            event.sender.send('parse-error', error)
          }
          resolve({ name, size: 0, success: false, error })
        }
      })
    })
  })

  ipcMain.handle('read-json-file', async (_, jsonPath: string): Promise<string | null> => {
    if (DataStore.isLargeFile()) return null
    try {
      return DataStore.getText()
    } catch {
      return null
    }
  })

  ipcMain.handle('get-json-summary', async (): Promise<{
    fileSize: number
    isLarge: boolean
    topLevelKeys: string[]
    parsedData: unknown
    preview: string
  }> => {
    const keys = DataStore.getTopLevelKeys()
    const parsed = DataStore.getParsed()
    const preview = DataStore.readStartingBytes(1024 * 10) ?? ''
    return {
      fileSize: DataStore.getFileSize(),
      isLarge: DataStore.isLargeFile(),
      topLevelKeys: keys,
      parsedData: parsed,
      preview
    }
  })

  ipcMain.handle('json-query', async (_, path: string): Promise<string | null> => {
    const result = DataStore.query(path)
    if (result === undefined) return null
    return JSON.stringify(result)
  })

  ipcMain.handle('json-read-chunk', async (_, start: number, length: number): Promise<string | null> => {
    return DataStore.readBytes(start, length)
  })

  ipcMain.handle('get-index-tree', async () => {
    return DataStore.getIndexTree()
  })

  ipcMain.handle('save-file', async (_, content: string, defaultName: string): Promise<boolean> => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    try {
      writeFileSync(result.filePath, content, 'utf-8')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('detect-editors', (): string | null => {
    const editor = findEditorPath()
    return editor?.name ?? null
  })

  ipcMain.handle('open-in-editor', async (_, content: string): Promise<boolean> => {
    const editor = findEditorPath()
    if (!editor) return false
    const tmpFile = join(tmpdir(), `xml2json-${Date.now()}.json`)
    writeFileSync(tmpFile, content, 'utf-8')
    tempFiles.add(tmpFile)
    spawn(editor.bin, [tmpFile], { detached: true, stdio: 'ignore' }).unref()
    return true
  })

  ipcMain.handle('start-mcp-server', async (_event, port: number): Promise<{ port: number }> => {
    try {
      const result = await mcpStart(port)
      return result
    } catch (err) {
      console.error('Failed to start MCP server:', err)
      throw err
    }
  })

  ipcMain.handle('stop-mcp-server', async () => {
    await mcpStop()
  })

  ipcMain.handle('get-mcp-status', async (): Promise<McpStatus> => {
    return mcpStatus()
  })
}
