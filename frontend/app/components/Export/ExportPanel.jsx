'use client'
import { useState, useRef, useCallback } from 'react'
import useStore from '@/app/store/useStore'
import { getInterpolatedPositions } from '@/app/utils/geoUtils'
import { ICON_SVGS } from '@/app/utils/iconConfig'
import { TILE_PROVIDERS } from '@/app/utils/tileProviders'

const FPS_OPTIONS = [1, 2, 5, 10]
const WIDTH_OPTIONS = [480, 720, 1080]
const DATETIME_MODE_OPTIONS = [
  { value: 'utc', label: 'データそのまま (UTC)' },
  { value: 'jst', label: '日本時間 (JST)' },
]
const MAX_EXPORT_FRAMES = 600  // フレーム上限（これ以上は等間隔で間引き）
const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const BACKEND_URL = /^https?:\/\//.test(rawBackendUrl) ? rawBackendUrl : `https://${rawBackendUrl}`

export default function ExportPanel() {
  const exportMethod = useStore((s) => s.exportMethod)
  const exportFps = useStore((s) => s.exportFps)
  const exportWidth = useStore((s) => s.exportWidth)
  const exportDrawDatetime = useStore((s) => s.exportDrawDatetime)
  const exportDatetimeMode = useStore((s) => s.exportDatetimeMode)
  const tileProvider = useStore((s) => s.tileProvider)
  const setExportMethod = useStore((s) => s.setExportMethod)
  const setExportFps = useStore((s) => s.setExportFps)
  const setExportWidth = useStore((s) => s.setExportWidth)
  const setExportDrawDatetime = useStore((s) => s.setExportDrawDatetime)
  const setExportDatetimeMode = useStore((s) => s.setExportDatetimeMode)
  const timeRange = useStore((s) => s.timeRange)
  const tracks = useStore((s) => s.tracks)
  const currentTime = useStore((s) => s.currentTime)
  const mapInstance = useStore((s) => s.mapInstance)
  const playbackSpeed = useStore((s) => s.playbackSpeed)
  const datetimeTextColor = TILE_PROVIDERS[tileProvider]?.exportDatetimeTextColor || '#ffffff'

  const hasData = tracks.length > 0 && timeRange.end > timeRange.start

  // 再生速度と FPS から動画の推定フレーム数・尺を計算
  // 1フレーム = playbackSpeed × 1000ms ÷ exportFps のシミュレーション時間
  const totalDurationMs = timeRange.end - timeRange.start
  const simMsPerFrame = (playbackSpeed * 1000) / exportFps
  const idealFrames = hasData ? Math.ceil(totalDurationMs / simMsPerFrame) : 0
  const exportFrameCount = Math.min(idealFrames, MAX_EXPORT_FRAMES)
  const exportVideoDurationSec = hasData ? Math.round(exportFrameCount / exportFps) : 0

  const [progress, setProgress] = useState(null) // 0-100 or null
  const [phase, setPhase] = useState('')
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const cancelRef = useRef(false)

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
        await exportClientGif({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, mapInstance })
      } else if (exportMethod === 'zip') {
        await exportZip({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance })
      } else if (exportMethod === 'server-gif') {
        await exportServerGif({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance })
      } else if (exportMethod === 'mp4') {
        await exportServerMp4({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance })
      }
    } catch (e) {
      setError(e.message || 'エクスポートに失敗しました')
      setProgress(null)
      setPhase('')
    }
  }, [exportMethod, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, timeRange, tracks, hasData, mapInstance])

  const handlePreview = useCallback(async () => {
    if (!hasData) return
    setIsPreviewing(true)
    setPreviewUrl(null)
    try {
      const [{ bgCanvas, toXY }, iconCache] = await Promise.all([
        captureMapBackground(mapInstance, exportWidth),
        buildIconCache(tracks, exportWidth),
      ])
      const canvas = renderFrame(
        tracks,
        currentTime,
        exportWidth,
        bgCanvas,
        toXY,
        iconCache,
        { drawDatetime: exportDrawDatetime, datetimeMode: exportDatetimeMode, datetimeTextColor }
      )
      setPreviewUrl(canvas.toDataURL('image/png'))
    } finally {
      setIsPreviewing(false)
    }
  }, [hasData, mapInstance, exportWidth, tracks, currentTime, exportDrawDatetime, exportDatetimeMode, datetimeTextColor])

  return (
    <div className="space-y-3">
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
          <option value="mp4">MP4動画（サーバ処理）</option>
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

      {/* 解像度 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">解像度</label>
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

      {/* 日時描画 */}
      <div className="bg-gray-800 rounded px-2 py-1.5 flex items-center justify-between">
        <div>
          <label className="text-xs text-gray-300">日時を描画</label>
          <p className="text-[10px] text-gray-500 mt-0.5">中央下部 / 文字色: ベースマップ連動</p>
        </div>
        <input
          type="checkbox"
          checked={exportDrawDatetime}
          onChange={(e) => setExportDrawDatetime(e.target.checked)}
          className="h-4 w-4 accent-cyan-500 cursor-pointer"
        />
      </div>

      {exportDrawDatetime && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">日時形式</label>
          <select
            value={exportDatetimeMode}
            onChange={(e) => setExportDatetimeMode(e.target.value)}
            className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
          >
            {DATETIME_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 出力プレビュー */}
      {hasData && (
        <div className="text-xs text-gray-500 bg-gray-800 rounded px-2 py-1.5 space-y-0.5">
          <div>再生速度 ×{playbackSpeed} / {exportFps}fps</div>
          <div>
            → {exportFrameCount}フレーム・約{exportVideoDurationSec}秒の動画
            {idealFrames > MAX_EXPORT_FRAMES && (
              <span className="text-yellow-500"> ※上限{MAX_EXPORT_FRAMES}fで間引き</span>
            )}
          </div>
        </div>
      )}

      {/* フレームプレビュー */}
      <button
        onClick={handlePreview}
        disabled={!hasData || isPreviewing || progress !== null}
        className="w-full py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 disabled:opacity-40"
      >
        {isPreviewing ? 'プレビュー生成中...' : '現在フレームをプレビュー'}
      </button>

      {previewUrl && (
        <div className="relative">
          <img
            src={previewUrl}
            alt="frame preview"
            className="w-full rounded border border-gray-600"
          />
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded px-1.5 py-0.5 hover:bg-black/80"
          >
            ✕
          </button>
        </div>
      )}

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
 * 各トラックのアイコン SVG を Image オブジェクトに変換してキャッシュする
 * key: `${iconType}_${color}` → Image
 */
async function buildIconCache(tracks, exportWidth) {
  const size = Math.round(exportWidth / 30)
  const cache = {}
  await Promise.all(
    tracks.filter((t) => t.visible).map(async (track) => {
      const type = track.iconType || 'airplane'
      const key = `${type}_${track.color}`
      if (cache[key]) return
      const svg = (ICON_SVGS[type] || ICON_SVGS.airplane).replace(/currentColor/g, track.color)
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      const img = await new Promise((resolve) => {
        const image = new Image(size, size)
        image.onload = () => resolve(image)
        image.onerror = () => resolve(null)
        image.src = url
      })
      if (img) cache[key] = img
    })
  )
  return cache
}

/**
 * エクスポート開始時にマップの背景と投影関数をキャプチャする
 * bgCanvas: マップタイルを描画した静止背景 Canvas
 * toXY: (lon, lat) → {x, y} エクスポートサイズ座標系
 */
async function captureMapBackground(mapInstance, exportWidth) {
  const exportHeight = Math.round(exportWidth * 0.5625)

  // project 関数は mapInstance に依存（bgCanvas が取れなくても使う）
  const buildToXY = (map) => {
    const container = map.getContainer()
    const scaleX = exportWidth / container.clientWidth
    const scaleY = exportHeight / container.clientHeight
    return (lon, lat) => {
      const pt = map.project([lon, lat])
      return { x: pt.x * scaleX, y: pt.y * scaleY }
    }
  }

  if (!mapInstance) return { bgCanvas: null, toXY: null }

  const toXY = buildToXY(mapInstance)

  // triggerRepaint → render イベント完了後にキャプチャする
  // (preserveDrawingBuffer:true でも render タイミング外では空になる場合がある)
  try {
    await new Promise((resolve) => {
      mapInstance.once('render', resolve)
      mapInstance.triggerRepaint()
      // フォールバック: 300ms 以内に render が来なければ進む
      setTimeout(resolve, 300)
    })

    const mapCanvas = mapInstance.getCanvas()
    // toDataURL 経由で確実に読み取る (drawImage 直接より安定)
    const dataUrl = mapCanvas.toDataURL('image/png')
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = dataUrl
    })

    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = exportWidth
    bgCanvas.height = exportHeight
    const bgCtx = bgCanvas.getContext('2d')
    bgCtx.drawImage(img, 0, 0, exportWidth, exportHeight)

    // 著作権表示を右下に描き込む（HTML オーバーレイはキャンバスに含まれないため）
    const attrEl = mapInstance.getContainer().querySelector('.maplibregl-ctrl-attrib-inner')
    const attrText = attrEl ? attrEl.innerText.trim() : ''
    if (attrText) {
      const fontSize = Math.max(10, Math.round(exportWidth / 72))
      bgCtx.font = `${fontSize}px sans-serif`
      const padding = 4
      const textW = bgCtx.measureText(attrText).width
      const boxX = exportWidth - textW - padding * 2 - 6
      const boxY = exportHeight - fontSize - padding * 2 - 4
      bgCtx.fillStyle = 'rgba(255,255,255,0.75)'
      bgCtx.fillRect(boxX, boxY, textW + padding * 2, fontSize + padding * 2)
      bgCtx.fillStyle = '#333333'
      bgCtx.fillText(attrText, boxX + padding, boxY + fontSize + padding - 1)
    }

    return { bgCanvas, toXY }
  } catch (e) {
    console.warn('Map background capture failed:', e)
    return { bgCanvas: null, toXY }
  }
}

function renderFrame(tracks, currentTime, width, bgCanvas, toXY, iconCache = {}, options = {}) {
  const { drawDatetime = false, datetimeMode = 'utc', datetimeTextColor = '#ffffff' } = options
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
    if (allPoints.length === 0) {
      if (drawDatetime) drawDatetimeLabel(ctx, width, height, currentTime, datetimeMode, datetimeTextColor)
      return canvas
    }
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

  // 現在位置アイコンを描画（iconCache に SVG Image があれば使い、なければ三角フォールバック）
  const iconSize = Math.round(width / 30)
  getInterpolatedPositions(tracks, currentTime).forEach(({ track, point }) => {
    if (!track.visible) return
    const { x, y } = project(point.lon, point.lat)
    const cacheKey = `${track.iconType || 'airplane'}_${track.color}`
    const iconImg = iconCache[cacheKey]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((point.direction * Math.PI) / 180)
    if (iconImg) {
      ctx.drawImage(iconImg, -iconSize / 2, -iconSize / 2, iconSize, iconSize)
    } else {
      // フォールバック: 塗りつぶし三角
      ctx.fillStyle = track.color
      ctx.beginPath()
      ctx.moveTo(0, -8)
      ctx.lineTo(5, 8)
      ctx.lineTo(0, 4)
      ctx.lineTo(-5, 8)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  })

  if (drawDatetime) drawDatetimeLabel(ctx, width, height, currentTime, datetimeMode, datetimeTextColor)
  return canvas
}

async function exportClientGif({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, mapInstance }) {
  const { default: GIF } = await import('gif.js')
  const totalDuration = timeRange.end - timeRange.start
  // 再生速度と FPS から1フレームあたりのシミュレーション時間を決定
  const simMsPerFrame = (playbackSpeed * 1000) / exportFps
  const frameCount = Math.min(Math.ceil(totalDuration / simMsPerFrame), MAX_EXPORT_FRAMES) || 1

  const [{ bgCanvas, toXY }, iconCache] = await Promise.all([
    captureMapBackground(mapInstance, exportWidth),
    buildIconCache(tracks, exportWidth),
  ])

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
    const canvas = renderFrame(tracks, t, exportWidth, bgCanvas, toXY, iconCache, {
      drawDatetime: exportDrawDatetime,
      datetimeMode: exportDatetimeMode,
      datetimeTextColor,
    })
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

async function exportZip({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance }) {
  const totalDuration = timeRange.end - timeRange.start
  const simMsPerFrame = (playbackSpeed * 1000) / exportFps
  const frameCount = Math.min(Math.ceil(totalDuration / simMsPerFrame), MAX_EXPORT_FRAMES) || 1
  const frames = []

  const [{ bgCanvas, toXY }, iconCache] = await Promise.all([
    captureMapBackground(mapInstance, exportWidth),
    buildIconCache(tracks, exportWidth),
  ])

  setPhase('フレーム生成中...')
  for (let i = 0; i <= frameCount; i++) {
    if (cancelRef.current) return
    const t = timeRange.start + (totalDuration * i) / frameCount
    const canvas = renderFrame(tracks, t, exportWidth, bgCanvas, toXY, iconCache, {
      drawDatetime: exportDrawDatetime,
      datetimeMode: exportDatetimeMode,
      datetimeTextColor,
    })
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

async function exportServerGif({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance }) {
  const totalDuration = timeRange.end - timeRange.start
  const simMsPerFrame = (playbackSpeed * 1000) / exportFps
  const frameCount = Math.min(Math.ceil(totalDuration / simMsPerFrame), MAX_EXPORT_FRAMES) || 1
  const frames = []

  const [{ bgCanvas, toXY }, iconCache] = await Promise.all([
    captureMapBackground(mapInstance, exportWidth),
    buildIconCache(tracks, exportWidth),
  ])

  setPhase('フレーム生成中...')
  for (let i = 0; i <= frameCount; i++) {
    if (cancelRef.current) return
    const t = timeRange.start + (totalDuration * i) / frameCount
    const canvas = renderFrame(tracks, t, exportWidth, bgCanvas, toXY, iconCache, {
      drawDatetime: exportDrawDatetime,
      datetimeMode: exportDatetimeMode,
      datetimeTextColor,
    })
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

async function exportServerMp4({ timeRange, tracks, exportFps, exportWidth, playbackSpeed, exportDrawDatetime, exportDatetimeMode, datetimeTextColor, setProgress, setPhase, cancelRef, BACKEND_URL, mapInstance }) {
  const totalDuration = timeRange.end - timeRange.start
  const simMsPerFrame = (playbackSpeed * 1000) / exportFps
  const frameCount = Math.min(Math.ceil(totalDuration / simMsPerFrame), MAX_EXPORT_FRAMES) || 1
  const frames = []

  const [{ bgCanvas, toXY }, iconCache] = await Promise.all([
    captureMapBackground(mapInstance, exportWidth),
    buildIconCache(tracks, exportWidth),
  ])

  setPhase('フレーム生成中...')
  for (let i = 0; i <= frameCount; i++) {
    if (cancelRef.current) return
    const t = timeRange.start + (totalDuration * i) / frameCount
    const canvas = renderFrame(tracks, t, exportWidth, bgCanvas, toXY, iconCache, {
      drawDatetime: exportDrawDatetime,
      datetimeMode: exportDatetimeMode,
      datetimeTextColor,
    })
    frames.push(canvas.toDataURL('image/png').split(',')[1])
    setProgress(Math.round(((i + 1) / (frameCount + 1)) * 70))
    await Promise.resolve()
  }

  setPhase('サーバ処理中...')
  setProgress(80)
  const res = await fetch(`${BACKEND_URL}/api/export/mp4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames, fps: exportFps }),
  })
  if (!res.ok) throw new Error('サーバエラー')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'track_animation.mp4'
  a.click()
  URL.revokeObjectURL(url)
  setProgress(null)
  setPhase('')
}

function drawDatetimeLabel(ctx, width, height, currentTime, datetimeMode, textColor) {
  const label = formatDatetimeForExport(currentTime, datetimeMode)
  if (!label) return
  const fontSize = Math.max(14, Math.round(width / 40))
  const bottomMargin = Math.max(10, Math.round(height / 35))
  ctx.save()
  ctx.font = `${fontSize}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = textColor
  ctx.fillText(label, width / 2, height - bottomMargin)
  ctx.restore()
}

function formatDatetimeForExport(ms, mode = 'utc') {
  if (!Number.isFinite(ms)) return ''
  const isJst = mode === 'jst'
  const offsetMs = isJst ? 9 * 60 * 60 * 1000 : 0
  const label = new Date(ms + offsetMs).toISOString().replace('T', ' ').slice(0, 19)
  return `${label} ${isJst ? 'JST' : 'UTC'}`
}
