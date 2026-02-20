'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
// CSS は layout.jsx でグローバルに読み込み済み
import useStore from '@/app/store/useStore'
import { TILE_PROVIDERS } from '@/app/utils/tileProviders'
import { getInterpolatedPositions, getTrailPoints } from '@/app/utils/geoUtils'
import { ICON_SVGS } from '@/app/utils/iconConfig'

const EMPTY_FC = { type: 'FeatureCollection', features: [] }

export default function MapView() {
  const mapContainer    = useRef(null)
  const mapRef          = useRef(null)
  const markersRef      = useRef({})   // { trackId: { marker, el } }
  const progMoveRef     = useRef(false)  // true の間は jumpTo によるストア更新をスキップ
  const userMovingRef   = useRef(false)  // ユーザーがドラッグ操作中は true
  const styleLoadedRef  = useRef(false)
  const isTileFirstRun  = useRef(true)

  const tracks             = useStore((s) => s.tracks)
  const currentTime        = useStore((s) => s.currentTime)
  const tileProvider       = useStore((s) => s.tileProvider)
  const mapCenterLat       = useStore((s) => s.mapCenter.lat)
  const mapCenterLon       = useStore((s) => s.mapCenter.lon)
  const mapZoom            = useStore((s) => s.mapZoom)
  const trailMode          = useStore((s) => s.trailMode)
  const trailWindowMinutes = useStore((s) => s.trailWindowMinutes)
  const iconSize           = useStore((s) => s.iconSize)
  const setMapCenter       = useStore((s) => s.setMapCenter)
  const setMapZoom         = useStore((s) => s.setMapZoom)
  const setMapInstance     = useStore((s) => s.setMapInstance)

  // ── MapLibre 初期化（マウント時1回）──────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: TILE_PROVIDERS[tileProvider]?.style || TILE_PROVIDERS.osm.style,
      center: [mapCenterLon, mapCenterLat],
      zoom: mapZoom,
      interactive: true,
      preserveDrawingBuffer: true,  // エクスポート用キャプチャに必要
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')

    // ユーザー操作の開始・終了を検出
    // e.originalEvent がある = ユーザー起因、ない = jumpTo 等のプログラム起因
    map.on('movestart', (e) => {
      if (e.originalEvent) userMovingRef.current = true
    })
    // ドラッグ終了後に一度だけ store を更新（毎フレーム更新によるループを回避）
    map.on('moveend', () => {
      userMovingRef.current = false
      if (progMoveRef.current) return
      const c = map.getCenter()
      setMapCenter({ lat: c.lat, lon: c.lng })
      setMapZoom(map.getZoom())
    })

    // スタイルロード完了後にトレイル用レイヤーを追加
    const initLayers = () => {
      styleLoadedRef.current = true
      if (!map.getSource('trails')) {
        map.addSource('trails', { type: 'geojson', data: EMPTY_FC })
        map.addLayer({
          id: 'trails',
          type: 'line',
          source: 'trails',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': 0.85,
          },
        })
      }
    }

    map.on('load', initLayers)
    // setStyle 後も再実行
    map.on('styledata', () => {
      if (map.isStyleLoaded()) initLayers()
    })

    mapRef.current = map
    setMapInstance(map)

    // コンテナサイズが確定してから MapLibre に通知
    requestAnimationFrame(() => { map.resize() })

    return () => {
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove())
      markersRef.current = {}
      styleLoadedRef.current = false
      setMapInstance(null)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── タイル変更（初回スキップ）────────────────────────────────────
  useEffect(() => {
    if (isTileFirstRun.current) { isTileFirstRun.current = false; return }
    if (!mapRef.current) return
    styleLoadedRef.current = false
    mapRef.current.setStyle(TILE_PROVIDERS[tileProvider]?.style || TILE_PROVIDERS.osm.style)
  }, [tileProvider])

  // ── サイドバーからのセンター・ズーム変更 ─────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    // ユーザーがドラッグ中なら jumpTo しない（操作を中断させない）
    if (userMovingRef.current) return
    progMoveRef.current = true
    mapRef.current.jumpTo({ center: [mapCenterLon, mapCenterLat], zoom: mapZoom })
    const id = setTimeout(() => { progMoveRef.current = false }, 200)
    return () => clearTimeout(id)
  }, [mapCenterLat, mapCenterLon, mapZoom])

  // ── トレイル＆アイコン更新 ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // トレイル（GeoJSON）
    if (styleLoadedRef.current && map.getSource('trails')) {
      const features = tracks
        .filter((t) => t.visible && t.points.length >= 2)
        .map((track) => {
          const pts = getTrailPoints(track.points, currentTime, trailMode, trailWindowMinutes)
          if (pts.length < 2) return null
          return {
            type: 'Feature',
            properties: { color: track.color },
            geometry: {
              type: 'LineString',
              coordinates: pts.map((p) => [p.lon, p.lat]),
            },
          }
        })
        .filter(Boolean)
      map.getSource('trails').setData({ type: 'FeatureCollection', features })
    }

    // アイコン（HTML Marker）
    const positions = getInterpolatedPositions(tracks, currentTime)
    const activeIds = new Set(positions.map(({ track }) => track.id))

    // 不要なマーカーを削除
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        markersRef.current[id].marker.remove()
        delete markersRef.current[id]
      }
    })

    // 追加 or 更新
    positions.forEach(({ track, point }) => {
      if (!track.visible) return

      const existing = markersRef.current[track.id]
      if (!existing) {
        const el = createIconEl(track.iconType, track.color, iconSize)
        // rotation は MapLibre の API で管理（el.style.transform を上書きしないため）
        const marker = new maplibregl.Marker({ element: el, rotation: point.direction })
          .setLngLat([point.lon, point.lat])
          .addTo(map)
        markersRef.current[track.id] = { marker, el }
      } else {
        existing.marker.setLngLat([point.lon, point.lat])
        existing.marker.setRotation(point.direction)
        updateIconEl(existing.el, track.color, iconSize, track.iconType)
      }
    })
  }, [tracks, currentTime, trailMode, trailWindowMinutes, iconSize])

  return (
    <div
      ref={mapContainer}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    />
  )
}

// ── アイコン要素ユーティリティ ─────────────────────────────────────

// direction は渡さない。回転は marker.setRotation() で MapLibre に任せる
function createIconEl(iconType, color, size) {
  const el = document.createElement('div')
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.style.pointerEvents = 'none'
  el.style.userSelect = 'none'
  updateIconEl(el, color, size, iconType)
  return el
}

function updateIconEl(el, color, size, iconType) {
  const type = iconType || el.dataset.iconType || 'airplane'
  el.dataset.iconType = type
  const svg = ICON_SVGS[type] || ICON_SVGS.airplane
  const colored = svg.replace(/currentColor/g, color)
  el.innerHTML = colored
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  // ★ transform は設定しない（MapLibre が位置決めに使うため上書き禁止）

  // SVGにスタイルを付与
  const svgEl = el.querySelector('svg')
  if (svgEl) {
    svgEl.style.width = '100%'
    svgEl.style.height = '100%'
    svgEl.style.display = 'block'
    svgEl.setAttribute('fill', color)
  }
}
