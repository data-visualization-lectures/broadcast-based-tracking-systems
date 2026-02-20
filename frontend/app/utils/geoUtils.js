/**
 * 現在時刻における各トラックの補間位置を計算
 */
export function getInterpolatedPositions(tracks, currentTime) {
  return tracks
    .filter((t) => t.visible && t.points.length > 0)
    .map((track) => {
      const point = interpolateTrack(track.points, currentTime)
      if (!point) return null
      return { track, point }
    })
    .filter(Boolean)
}

function interpolateTrack(points, t) {
  if (points.length === 0) return null
  if (t <= points[0].t) return points[0]
  if (t >= points[points.length - 1].t) return points[points.length - 1]

  // 二分探索
  let lo = 0
  let hi = points.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].t <= t) lo = mid
    else hi = mid
  }

  const p0 = points[lo]
  const p1 = points[hi]
  const ratio = (t - p0.t) / (p1.t - p0.t)

  return {
    t,
    lat: p0.lat + (p1.lat - p0.lat) * ratio,
    lon: p0.lon + (p1.lon - p0.lon) * ratio,
    altitude: p0.altitude + (p1.altitude - p0.altitude) * ratio,
    speed: p0.speed,
    direction: interpolateAngle(p0.direction, p1.direction, ratio),
  }
}

function interpolateAngle(a, b, t) {
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return (a + diff * t + 360) % 360
}

/**
 * トレイルポイントを取得（現在時刻より前のポイント列）
 */
export function getTrailPoints(points, currentTime, trailMode, trailWindowMinutes) {
  if (trailMode === 'none') return []

  const windowMs = trailWindowMinutes * 60 * 1000

  return points.filter((p) => {
    if (p.t > currentTime) return false
    if (trailMode === 'window' && p.t < currentTime - windowMs) return false
    return true
  })
}

/**
 * 全トラックを包むバウンディングボックス
 */
export function getBounds(tracks) {
  const all = tracks.flatMap((t) => t.points)
  if (all.length === 0) return null
  return {
    minLat: Math.min(...all.map((p) => p.lat)),
    maxLat: Math.max(...all.map((p) => p.lat)),
    minLon: Math.min(...all.map((p) => p.lon)),
    maxLon: Math.max(...all.map((p) => p.lon)),
  }
}
