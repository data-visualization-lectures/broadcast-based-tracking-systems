'use client'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PathLayer, IconLayer } from '@deck.gl/layers'
// CSS は layout.jsx でグローバルに読み込み済み
import useStore from '@/app/store/useStore'
import { TILE_PROVIDERS } from '@/app/utils/tileProviders'
import { getInterpolatedPositions, getTrailPoints } from '@/app/utils/geoUtils'
import { ICON_SVGS, svgToDataUrl } from '@/app/utils/iconConfig'

export default function MapView() {
  const mapContainer    = useRef(null)
  const mapRef          = useRef(null)
  const overlayRef      = useRef(null)   // Deck.gl MapboxOverlay
  const iconDefCacheRef = useRef(new Map()) // IconLayer auto-pack 用の安定キーキャッシュ
  const pngCacheRef     = useRef(new Map()) // SVG→PNG ラスタライズ済みキャッシュ
  const [pngCacheVersion, setPngCacheVersion] = useState(0) // PNG準備完了でDeck.gl再描画を起こす
  const progMoveRef     = useRef(false)  // true の間は jumpTo によるストア更新をスキップ
  const userMovingRef   = useRef(false)  // ユーザーがドラッグ操作中は true
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

  // ── SVG→PNG 事前ラスタライズ（Deck.gl は SVG data URL を読めないため）──
  useEffect(() => {
    const needed = tracks.filter((t) => {
      const key = `${t.iconType || 'airplane'}_${t.color}`
      return !pngCacheRef.current.has(key)
    })
    if (needed.length === 0) return

    Promise.all(
      needed.map((track) => new Promise((resolve) => {
        const type = track.iconType || 'airplane'
        const key = `${type}_${track.color}`
        const svgUrl = svgToDataUrl(ICON_SVGS[type] || ICON_SVGS.airplane, track.color)
        const img = new Image(64, 64)
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = 64; c.height = 64
          c.getContext('2d').drawImage(img, 0, 0, 64, 64)
          pngCacheRef.current.set(key, c.toDataURL('image/png'))
          resolve()
        }
        img.onerror = () => resolve()
        img.src = svgUrl
      }))
    ).then(() => {
      iconDefCacheRef.current.clear() // Deck.gl キャッシュをクリアして PNG を使わせる
      setPngCacheVersion((v) => v + 1)
    })
  }, [tracks])

  // ── MapLibre 初期化（マウント時1回）──────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    // コンテナのサイズを確保
    const container = mapContainer.current
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.warn('MapContainer has no size yet')
      return
    }

    // コンテナに明示的にサイズを設定
    container.style.width = '100%'
    container.style.height = '100%'

    const map = new maplibregl.Map({
      container: container,
      style: TILE_PROVIDERS[tileProvider]?.style || TILE_PROVIDERS.osm.style,
      center: [mapCenterLon, mapCenterLat],
      zoom: mapZoom,
      interactive: true,
      preserveDrawingBuffer: true,  // エクスポート用キャプチャに必要
      pixelRatio: window.devicePixelRatio,  // Device Pixel Ratio を明示的に設定
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

    // Deck.gl オーバーレイを追加（MapLibre 上に別 canvas として重ねる）
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] })
    map.addControl(overlay)
    overlayRef.current = overlay

    mapRef.current = map
    setMapInstance(map)

    // style.load 後に resize
    const onStyleLoad = () => {
      map.resize()
    }
    map.on('style.load', onStyleLoad)

    // コンテナサイズが確定・変化したとき MapLibre に通知（16:9 ボックス対応）
    const ro = new ResizeObserver(() => { map.resize() })
    ro.observe(mapContainer.current)

    return () => {
      ro.disconnect()
      overlayRef.current = null
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

  // ── Deck.gl レイヤー更新（トレイル＆アイコン）────────────────────
  useEffect(() => {
    if (!overlayRef.current) return

    const getCachedIconDef = (track) => {
      const type = track.iconType || 'airplane'
      const key = `${type}_${track.color}`
      if (iconDefCacheRef.current.has(key)) return iconDefCacheRef.current.get(key)

      const pngUrl = pngCacheRef.current.get(key)
      if (!pngUrl) return null // PNG がまだ準備できていない

      const iconDef = {
        id: key,
        url: pngUrl, // SVG ではなく PNG を使用（Deck.gl は SVG data URL を読めない）
        width: 64,
        height: 64,
        anchorX: 32,
        anchorY: 32,
      }
      iconDefCacheRef.current.set(key, iconDef)
      return iconDef
    }

    // ── PathLayer: トレイル ──
    const trailData = tracks
      .filter((t) => t.visible && t.points.length >= 2)
      .flatMap((track) => {
        const pts = getTrailPoints(track.points, currentTime, trailMode, trailWindowMinutes)
        if (pts.length < 2) return []

        // 経度ラップで線を分割（±180° を超える場合）
        const segments = []
        let currentSegment = [pts[0]]

        for (let i = 1; i < pts.length; i++) {
          const prevLon = pts[i - 1].lon
          const currLon = pts[i].lon
          const lonDiff = Math.abs(currLon - prevLon)

          // 経度差が180°を超える場合は線を分割
          if (lonDiff > 180) {
            segments.push(currentSegment)
            currentSegment = [pts[i]]
          } else {
            currentSegment.push(pts[i])
          }
        }
        segments.push(currentSegment)

        return segments
          .filter((seg) => seg.length >= 2)
          .map((seg) => ({
            path: seg.map((p) => [p.lon, p.lat]),
            color: hexToRgba(track.color, 217),  // 0.85 opacity
          }))
      })

    // ── IconLayer: アイコン ──
    const positions = getInterpolatedPositions(tracks, currentTime)
    const iconData = positions
      .filter(({ track }) => track.visible)
      .map(({ track, point }) => {
        const icon = getCachedIconDef(track)
        if (!icon) return null // PNG 未準備のアイコンはスキップ
        return {
          coordinates: [point.lon, point.lat],
          direction: point.direction || 0,
          icon,
          size: iconSize,
        }
      })
      .filter(Boolean)

    overlayRef.current.setProps({
      layers: [
        new PathLayer({
          id: 'trails',
          data: trailData,
          getPath: (d) => d.path,
          getColor: (d) => d.color,
          getWidth: 2,
          widthUnits: 'pixels',
          widthMinPixels: 1,
        }),
        new IconLayer({
          id: 'icons',
          data: iconData,
          getPosition: (d) => d.coordinates,
          getIcon: (d) => d.icon,
          getSize: (d) => d.size,
          // Deck.gl の角度は CCW（反時計回り）なので、CW のコンパス方位を符号反転
          getAngle: (d) => -d.direction,
          sizeUnits: 'pixels',
        }),
      ],
    })
  }, [tracks, currentTime, trailMode, trailWindowMinutes, iconSize, pngCacheVersion])

  return (
    <div
      ref={mapContainer}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    />
  )
}

// ── ユーティリティ ─────────────────────────────────────────────────

function hexToRgba(hex, alpha = 255) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b, alpha]
}
