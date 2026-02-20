'use client'
import { useState, useRef, useCallback } from 'react'
import useStore from '@/app/store/useStore'
import { getInterpolatedPositions } from '@/app/utils/geoUtils'

const FPS_OPTIONS = [1, 2, 5, 10]
const WIDTH_OPTIONS = [480, 720, 1080]
const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const BACKEND_URL = /^https?:\/\//.test(rawBackendUrl) ? rawBackendUrl : `https://${rawBackendUrl}`

export default function ExportPanel() {
  const exportMethod = useStore((s) => s.exportMethod)
  const exportFps = useStore((s) => s.exportFps)
  const exportWidth = useStore((s) => s.exportWidth)
  const setExportMethod = useStore((s) => s.setExportMethod)
  const setExportFps = useStore((s) => s.setExportFps)
  const setExportWidth = useStore((s) => s.setExportWidth)
  const timeRange = useStore((s) => s.timeRange)
  const tracks = useStore((s) => s.tracks)
  const mapInstance = useStore((s) => s.mapInstance)

  const [progress, setProgress] = useState(null) // 0-100 or null
  const [phase, setPhase] = useState('')
  const [error, setError] = useState(null)
  const cancelRef = useRef(false)

  const hasData = tracks.length > 0 && timeRange.end > timeRange.start

  const handleExport = useCallback(async () => {
    if (!hasData) return
    // 即座に UI を更新してボタンを無効化・進捗表示を開始
    setError(null)
    setProgress(0)
    setPhase('準備中...')
    cancelRef.current = false

    // React の再レンダーをブラウザに反映させてからヘビーな処理を開始
    await new Promise(r => setTimeout(r, 50))

    try {
      if (exportMethod === 'client-gif') {
        await exportClientGif({ timeRange, tracks, exportFps, exportWidth, setProgress, setPhase, cancelRef, mapInstance })
      } else if (exportMethod === 'zip') {
        await exportZip({ timeRange, tracks, exportFps, exportWidth, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance })
      } else if (exportMethod === 'server-gif') {
        await exportServerGif({ timeRange, tracks, exportFps, exportWidth, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance })
      }
    } catch (e) {
      setError(e.message || 'エクスポートに失敗しました')
      setProgress(null)
      setPhase('')
    }
  }, [exportMethod, exportFps, exportWidth, timeRange, tracks, hasData, mapInstance])

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">エクスポート</h3>

      {/* 方式 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">方式</label>
        <select
          value={exportMethod}
          onChange={(e) => setExportMethod(e.target.value)}
          className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
        >
          <option value="client-gif">クライアントGIF（推奨）</option>
          <option value="server-gif">サーバGIF</option>
          <option value="zip">連番PNG ZIP</option>
        </select>
      </div>

      {/* FPS */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">FPS</label>
        <div className="flex gap-1">
          {FPS_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => setExportFps(f)}
              className={`flex-1 py-1 rounded text-xs ${
                exportFps === f
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 幅 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">幅</label>
        <div className="flex gap-1">
          {WIDTH_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setExportWidth(w)}
              className={`flex-1 py-1 rounded text-xs ${
                exportWidth === w
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* 開始ボタン */}
      <button
        onClick={handleExport}
        disabled={!hasData || progress !== null}
        className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold disabled:opacity-40"
      >
        {progress !== null ? `${phase} ${progress}%` : 'エクスポート開始'}
      </button>

      {progress !== null && (
        <button
          onClick={() => { cancelRef.current = true; setProgress(null); setPhase('') }}
          className="w-full py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300"
        >
          キャンセル
        </button>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</p>
      )}

      {!hasData && (
        <p className="text-xs text-gray-600 text-center">データを読み込んでください</p>
      )}
    </div>
  )
}

// ---- エクスポート実装 ----

/**
 * エクスポート開始時にマップの背景と投影関数をキャプチャする
 * bgCanvas: マップタイルを描画した静止背景 Canvas
 * toXY: (lon, lat) → {x, y} エクスポートサイズ座標系
 */
function captureMapBackground(mapInstance, exportWidth) {
  const exportHeight = Math.round(exportWidth * 0.5625)
  if (!mapInstance) return { bgCanvas: null, toXY: null }

  const mapCanvas = mapInstance.getCanvas()
  const bgCanvas = document.createElement('canvas')
  bgCanvas.width = exportWidth
  bgCanvas.height = exportHeight
  bgCanvas.getContext('2d').drawImage(mapCanvas, 0, 0, exportWidth, exportHeight)

  // project() は CSS px を返すので、CSSコンテナサイズ基準でスケール
  const container = mapInstance.getContainer()
  const scaleX = exportWidth / container.clientWidth
  const scaleY = exportHeight / container.clientHeight
  const toXY = (lon, lat) => {
    const pt = mapInstance.project([lon, lat])
    return { x: pt.x * scaleX, y: pt.y * scaleY }
  }

  return { bgCanvas, toXY }
}

function renderFrame(tracks, currentTime, width, bgCanvas, toXY) {
  const height = Math.round(width * 0.5625)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // 背景: マップタイル（キャプチャ済み）またはフォールバック色
  if (bgCanvas) {
    ctx.drawImage(bgCanvas, 0, 0, width, height)
  } else {
    ctx.fillStyle = '#0f3460'
    ctx.fillRect(0, 0, width, height)
  }

  // 座標変換関数（mapInstance なし時は簡易 lat/lon → pixel 変換）
  let project = toXY
  if (!project) {
    const allPoints = tracks.flatMap((t) => t.points)
    if (allPoints.length === 0) return canvas
    const lats = allPoints.map((p) => p.lat)
    const lons = allPoints.map((p) => p.lon)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const latRange = (maxLat - minLat) * 1.1 || 1
    const lonRange = (maxLon - minLon) * 1.1 || 1
    const cLat = (minLat + maxLat) / 2
    const cLon = (minLon + maxLon) / 2
    project = (lon, lat) => ({
      x: ((lon - cLon) / lonRange + 0.5) * width,
      y: (0.5 - (lat - cLat) / latRange) * height,
    })
  }

  // 軌跡を描画
  tracks.filter((t) => t.visible && t.points.length >= 2).forEach((track) => {
    const pastPoints = track.points.filter((p) => p.t <= currentTime)
    if (pastPoints.length < 2) return
    ctx.strokeStyle = track.color + 'cc'
    ctx.lineWidth = 2
    ctx.beginPath()
    pastPoints.forEach((p, i) => {
      const { x, y } = project(p.lon, p.lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  })

  // 現在位置アイコンを描画
  getInterpolatedPositions(tracks, currentTime).forEach(({ track, point }) => {
    if (!track.visible) return
    const { x, y } = project(point.lon, point.lat)
    ctx.fillStyle = track.color
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((point.direction * Math.PI) / 180)
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(5, 8)
    ctx.lineTo(0, 4)
    ctx.lineTo(-5, 8)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  })

  return canvas
}

async function exportClientGif({ timeRange, tracks, exportFps, exportWidth, setProgress, setPhase, cancelRef, mapInstance }) {
  const { default: GIF } = await import('gif.js')
  const totalDuration = timeRange.end - timeRange.start
  const frameInterval = 1000 / exportFps
  const simStepMs = totalDuration / Math.ceil(totalDuration / (frameInterval * 10))
  const frameCount = Math.ceil(totalDuration / (simStepMs * exportFps)) || 30

  const { bgCanvas, toXY } = captureMapBackground(mapInstance, exportWidth)

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: exportWidth,
    height: Math.round(exportWidth * 0.5625),
    workerScript: '/gif.worker.js',
  })

  // フェーズ1: フレーム生成 (0 → 70%)
  setPhase('フレーム生成中...')
  for (let i = 0; i <= frameCount; i++) {
    if (cancelRef.current) return
    const t = timeRange.start + (totalDuration * i) / frameCount
    const canvas = renderFrame(tracks, t, exportWidth, bgCanvas, toXY)
    gif.addFrame(canvas, { delay: Math.round(1000 / exportFps), copy: true })
    setProgress(Math.round(((i + 1) / (frameCount + 1)) * 70))
    await Promise.resolve() // React が進捗バーを更新できるよう毎フレーム yield
  }

  // フェーズ2: GIFエンコード (70 → 100%)
  setPhase('GIFエンコード中...')
  setProgress(70)
  await new Promise((resolve, reject) => {
    gif.on('progress', (p) => {
      setProgress(70 + Math.round(p * 30))
    })
    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `track_animation.gif`
      a.click()
      URL.revokeObjectURL(url)
      setProgress(null)
      setPhase('')
      resolve()
    })
    gif.on('error', reject)
    gif.render()
  })
}

async function exportZip({ timeRange, tracks, exportFps, exportWidth, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance }) {
  const totalDuration = timeRange.end - timeRange.start
  const frameCount = Math.min(Math.ceil(totalDuration / 1000) * exportFps, 300)
  const frames = []

  const { bgCanvas, toXY } = captureMapBackground(mapInstance, exportWidth)

  setPhase('フレーム生成中...')
  for (let i = 0; i <= frameCount; i++) {
    if (cancelRef.current) return
    const t = timeRange.start + (totalDuration * i) / frameCount
    const canvas = renderFrame(tracks, t, exportWidth, bgCanvas, toXY)
    frames.push(canvas.toDataURL('image/png').split(',')[1])
    setProgress(Math.round(((i + 1) / (frameCount + 1)) * 70))
    await Promise.resolve()
  }

  setPhase('サーバ処理中...')
  setProgress(80)
  const res = await fetch(`${BACKEND_URL}/api/export/zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames, filename_prefix: 'frame' }),
  })
  if (!res.ok) throw new Error('サーバエラー')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'track_frames.zip'
  a.click()
  URL.revokeObjectURL(url)
  setProgress(null)
  setPhase('')
}

async function exportServerGif({ timeRange, tracks, exportFps, exportWidth, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance }) {
  const totalDuration = timeRange.end - timeRange.start
  const frameCount = Math.min(Math.ceil(totalDuration / 1000) * exportFps, 200)
  const frames = []

  const { bgCanvas, toXY } = captureMapBackground(mapInstance, exportWidth)

  setPhase('フレーム生成中...')
  for (let i = 0; i <= frameCount; i++) {
    if (cancelRef.current) return
    const t = timeRange.start + (totalDuration * i) / frameCount
    const canvas = renderFrame(tracks, t, exportWidth, bgCanvas, toXY)
    frames.push(canvas.toDataURL('image/png').split(',')[1])
    setProgress(Math.round(((i + 1) / (frameCount + 1)) * 70))
    await Promise.resolve()
  }

  setPhase('サーバ処理中...')
  setProgress(80)
  const res = await fetch(`${BACKEND_URL}/api/export/gif`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames, fps: exportFps, loop: 0 }),
  })
  if (!res.ok) throw new Error('サーバエラー')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'track_animation.gif'
  a.click()
  URL.revokeObjectURL(url)
  setProgress(null)
  setPhase('')
}
