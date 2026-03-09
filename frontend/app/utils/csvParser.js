import Papa from 'papaparse'

/** row から大文字小文字を無視してキーの値を取得する */
function getField(row, ...names) {
  for (const key of Object.keys(row)) {
    const lower = key.trim().toLowerCase()
    for (const name of names) {
      if (lower === name.toLowerCase()) return row[key]
    }
  }
  return undefined
}

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
  const headersLower = headers.map((h) => h.toLowerCase())
  const isAdsb = headersLower.includes('callsign')
  const isAis = headersLower.some((h) => ['mmsi', 'vessel_name', 'vesselname'].includes(h))
  const type = isAdsb ? 'aircraft' : isAis ? 'vessel' : 'aircraft'

  // Callsign でグループ化（複数機体が1ファイルに含まれる場合）
  const groupKey = type === 'aircraft'
    ? (row) => getField(row, 'callsign') || 'UNKNOWN'
    : (row) => getField(row, 'mmsi') || getField(row, 'vesselname', 'vessel_name') || 'UNKNOWN'

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

/** タイムスタンプ文字列をミリ秒に変換する */
function parseTimestamp(raw) {
  if (raw == null || raw === '') return null
  const str = String(raw).trim()

  // Unixタイムスタンプ（数値のみ）
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = Number(str)
    // 13桁以上ならミリ秒、それ以外は秒として扱う
    return num > 9999999999 ? num : num * 1000
  }

  // YYYYMMDD_HHMMSS 形式
  const compact = str.match(/^(\d{4})(\d{2})(\d{2})[_T](\d{2})(\d{2})(\d{2})$/)
  if (compact) {
    const iso = `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`
    return new Date(iso).getTime()
  }

  // ISO 8601 やその他の日時文字列（Date.parse で解釈可能なもの）
  const ms = Date.parse(str)
  return isNaN(ms) ? null : ms
}

function parseRow(row, type) {
  try {
    // timestamp
    const rawTs = getField(row, 'timestamp', 'time', 'datetime', 'date_time', 'date')
    const t = parseTimestamp(rawTs)

    // position: "lat,lon" 結合形式 or 個別カラム
    let lat, lon
    const pos = getField(row, 'position') || ''
    if (pos) {
      const parts = pos.replace(/^"|"$/g, '').split(',')
      if (parts.length >= 2) {
        lat = parseFloat(parts[0])
        lon = parseFloat(parts[1])
      }
    }
    if (lat == null || isNaN(lat)) {
      lat = parseFloat(getField(row, 'lat', 'latitude'))
      lon = parseFloat(getField(row, 'lon', 'longitude'))
    }

    if (!t || isNaN(lat) || isNaN(lon)) return null

    return {
      t,
      lat,
      lon,
      altitude: Number(getField(row, 'altitude') || 0),
      speed: Number(getField(row, 'speed') || 0),
      direction: Number(getField(row, 'direction', 'course') || 0),
    }
  } catch {
    return null
  }
}
