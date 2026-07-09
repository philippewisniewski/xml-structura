import type { TreeNode } from './tree-builder'

export interface GpxMetrics {
  name: string
  trackCount: number
  waypointCount: number
  routeCount: number
  totalDistanceKm: number
  totalElevationGainM: number
  totalDuration: string
  startTime: string | null
  endTime: string | null
}

export function extractGpxMetrics(tree: TreeNode): GpxMetrics | null {
  const gpx = tree.children.find(c => c.tag === 'gpx')
  if (!gpx) return null

  const trks = findChildren(gpx, 'trk')
  const wpts = findChildren(gpx, 'wpt')
  const rtes = findChildren(gpx, 'rte')

  const name = findText(gpx, 'metadata', 'name') || ''

  const metrics: GpxMetrics = {
    name,
    trackCount: trks.length,
    waypointCount: wpts.length,
    routeCount: rtes.length,
    totalDistanceKm: 0,
    totalElevationGainM: 0,
    totalDuration: '0:00',
    startTime: null,
    endTime: null
  }

  let totalDist = 0
  let totalEleGain = 0
  let start: string | null = null
  let end: string | null = null

  for (const trk of trks) {
    const trkseg = findChildren(trk, 'trkseg')
    for (const seg of trkseg) {
      const pts = findChildren(seg, 'trkpt')
      let prevLat = 0, prevLon = 0, prevEle = 0
      let first = true

      for (const pt of pts) {
        const lat = parseFloat(pt.attributes['lat'] ?? '0')
        const lon = parseFloat(pt.attributes['lon'] ?? '0')
        const eleText = findTextNode(pt, 'ele')
        const ele = eleText ? parseFloat(eleText) : 0
        const time = findTextNode(pt, 'time')

        if (!first) {
          totalDist += haversine(prevLat, prevLon, lat, lon)
          if (ele > prevEle) totalEleGain += ele - prevEle
        } else {
          first = false
        }

        if (time && !start) start = time
        if (time) end = time

        prevLat = lat
        prevLon = lon
        prevEle = ele
      }
    }
  }

  metrics.totalDistanceKm = Math.round(totalDist * 100) / 100
  metrics.totalElevationGainM = Math.round(totalEleGain)
  metrics.startTime = start
  metrics.endTime = end
  if (start && end) metrics.totalDuration = computeDuration(start, end)

  return metrics
}

function findChildren(node: TreeNode, tag: string): TreeNode[] {
  return node.children.filter(c => c.tag === tag)
}

function findText(node: TreeNode, ...tags: string[]): string | undefined {
  let current = node
  for (const tag of tags) {
    const child = current.children.find(c => c.tag === tag)
    if (!child) return undefined
    current = child
  }
  return current.text
}

function findTextNode(node: TreeNode, tag: string): string | undefined {
  const child = node.children.find(c => c.tag === tag)
  return child?.text
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function computeDuration(start: string, end: string): string {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (isNaN(s) || isNaN(e)) return '0:00'
  const diffMs = e - s
  const hrs = Math.floor(diffMs / 3600000)
  const mins = Math.floor((diffMs % 3600000) / 60000)
  return `${hrs}:${mins.toString().padStart(2, '0')}`
}
