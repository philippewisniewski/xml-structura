export interface RecentFile {
  name: string
  path: string
  timestamp: number
}

export interface FileResult {
  content: string
  name: string
  path?: string
  size: number
}

export interface ParseResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface FileInfo {
  size: number
  lines: number
}

export type ParserMode = 'xml' | 'gpx'

export interface McpStatus {
  running: boolean
  port: number | null
}
