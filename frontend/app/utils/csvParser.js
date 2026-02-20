import Papa from 'papaparse'

/**
 * CSV テキストをパースしてトラックオブジェクトを返す
 * @param {string} text - CSV 文字列
 * @param {string} filename - 元ファイル名（ラベルに使用）
 * @returns {{ id, label, type, points[] }}
 */
export function parseCsv(text, filename) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors)
  }

  const rows = result.data
  if (rows.length === 0) throw new Error('データが空です')

  const headers = Object.keys(rows[0]).map((h) => h.trim())

  // 種別判定
  const isAdsb = headers.some((h) =>
    ['callsign', 'Callsign'].includes(h)
  )
  const isAis = headers.some((h) =>
    ['mmsi', 'MMSI', 'vessel_name', 'VesselName'].includes(h)
  )
  const type = isAdsb ? 'aircraft' : isAis ? 'vessel' : 'aircraft'

  // Callsign でグループ化（複数機体が1ファイルに含まれる場合）
  const groupKey = type === 'aircraft'
    ? (row) => row.Callsign || row.callsign || 'UNKNOWN'
    : (row) => row.MMSI || row.mmsi || row.VesselName || row.vessel_name || 'UNKNOWN'

  const groups = {}
  for (const row of rows) {
    const key = groupKey(row)
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
  }

  return Object.entries(groups).map(([label, groupRows]) => {
    const points = groupRows
      .map((row) => parseRow(row, type))
      .filter(Boolean)
      .sort((a, b) => a.t - b.t)

    return {
      id: `${filename}-${label}-${Date.now()}-${Math.random()}`,
      label,
      type,
      iconType: type === 'aircraft' ? 'airplane' : 'ship',
      points,
    }
  })
}

function parseRow(row, type) {
  try {
    // timestamp
    const rawTs = row.Timestamp || row.timestamp
    const t = rawTs ? Number(rawTs) * 1000 : null

    // position: "lat,lon" 形式
    const pos = row.Position || row.position || ''
    const parts = pos.replace(/^"|"$/g, '').split(',')
    if (parts.length < 2) return null
    const lat = parseFloat(parts[0])
    const lon = parseFloat(parts[1])

    if (!t || isNaN(lat) || isNaN(lon)) return null

    return {
      t,
      lat,
      lon,
      altitude: Number(row.Altitude || row.altitude || 0),
      speed: Number(row.Speed || row.speed || 0),
      direction: Number(row.Direction || row.direction || row.Course || row.course || 0),
    }
  } catch {
    return null
  }
}
