export interface RecentFile {
  name: string
  path: string
  timestamp: number
}

export interface FileResult {
  name: string
  path?: string
  size: number
}

export interface ParseProgressData {
  bytesRead: number
  totalBytes: number
  phase: 'parsing'
}

export interface McpStatus {
  running: boolean
  port: number | null
}

export interface JsonSummary {
  fileSize: number
  isLarge: boolean
  topLevelKeys: string[]
  parsedData: unknown
  preview: string
}

export interface IndexTreeNode {
  name: string
  path: string
  nodeType: 'object' | 'array' | 'scalar'
  children: IndexTreeNode[]
  childCount: number
}
