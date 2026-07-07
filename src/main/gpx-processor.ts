function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface TrackPoint {
  lat: number
  lon: number
  ele: number | null
  time: Date
}

export interface GpxStats {
  totalPoints: number
  startLat: number
  startLon: number
  kmSplits: number[]
  kmElevationGain: number[]
  kmElevationLoss: number[]
  routePolyline: [number, number][]
}

export function createGpxProcessor(): {
  processTrkpt: (pt: TrackPoint) => void
  getStats: () => GpxStats
} {
  let totalPoints = 0
  let firstPt: { lat: number; lon: number } | null = null
  let prevPt: { lat: number; lon: number; ele: number | null; time: Date } | null = null
  let cumulativeDist = 0
  let kmBoundary = 1
  let kmStartTime: Date | null = null
  let kmElevGain = 0
  let kmElevLoss = 0
  const kmSplits: number[] = []
  const kmElevationGain: number[] = []
  const kmElevationLoss: number[] = []
  const routePolyline: [number, number][] = []

  function processTrkpt(pt: TrackPoint): void {
    totalPoints++
    if (!firstPt) {
      firstPt = { lat: pt.lat, lon: pt.lon }
      kmStartTime = pt.time
    }

    if (totalPoints % 10 === 0) {
      routePolyline.push([pt.lat, pt.lon])
    }

    if (prevPt) {
      const dist = haversine(prevPt.lat, prevPt.lon, pt.lat, pt.lon)
      cumulativeDist += dist

      if (pt.ele != null && prevPt.ele != null) {
        const delta = pt.ele - prevPt.ele
        if (delta > 0) kmElevGain += delta
        else kmElevLoss += Math.abs(delta)
      }

      if (cumulativeDist >= kmBoundary) {
        if (kmStartTime) {
          const elapsedMs = pt.time.getTime() - kmStartTime.getTime()
          const elapsedMin = elapsedMs / 1000 / 60
          if (elapsedMin > 0 && elapsedMin <= 12) {
            kmSplits.push(Math.round(elapsedMin * 60))
            kmElevationGain.push(Math.round(kmElevGain))
            kmElevationLoss.push(Math.round(kmElevLoss))
          }
        }
        kmStartTime = pt.time
        kmBoundary++
        kmElevGain = 0
        kmElevLoss = 0
      }
    }

    prevPt = pt
  }

  function getStats(): GpxStats {
    return {
      totalPoints,
      startLat: firstPt?.lat ?? 0,
      startLon: firstPt?.lon ?? 0,
      kmSplits,
      kmElevationGain,
      kmElevationLoss,
      routePolyline
    }
  }

  return { processTrkpt, getStats }
}
