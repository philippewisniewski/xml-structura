const STORAGE_KEY = 'xml-structura-recent-files'
const MAX_FILES = 20

export interface RecentFile {
  name: string
  lastOpened: number
}

export function loadRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecentFile(file: RecentFile): void {
  const files = loadRecentFiles()
  const idx = files.findIndex(f => f.name === file.name)
  if (idx >= 0) files.splice(idx, 1)
  files.unshift(file)
  if (files.length > MAX_FILES) files.length = MAX_FILES
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files))
}

export function removeRecentFile(name: string): void {
  const files = loadRecentFiles().filter(f => f.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files))
}

const fileHandleMap = new Map<string, FileSystemFileHandle>()

export function storeFileHandle(name: string, handle: FileSystemFileHandle): void {
  fileHandleMap.set(name, handle)
}

export function getFileHandle(name: string): FileSystemFileHandle | undefined {
  return fileHandleMap.get(name)
}
