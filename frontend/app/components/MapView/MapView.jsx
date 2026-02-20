'use client'
import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Deck } from '@deck.gl/core'
import { PathLayer, IconLayer, ScatterplotLayer } from '@deck.gl/layers'
import useStore from '@/app/store/useStore'
import { TILE_PROVIDERS } from '@/app/utils/tileProviders'
import { getInterpolatedPositions, getTrailPoints } from '@/app/utils/geoUtils'
import { ICON_SVGS, svgToDataUrl } from '@/app/utils/iconConfig'

// SVGアイコンを Canvas に描画してテクスチャを作成
function buildIconAtlas(size = 128) {
  if (typeof window === 'undefined') return { iconAtlas: null, iconMapping: {} }

  const keys = Object.keys(ICON_SVGS)
  const canvas = document.createElement('canvas')
  canvas.width = size * keys.length
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const mapping = {}
  keys.forEach((key, i) => {
    mapping[key] = { x: i * size, y: 0, width: size, height: size, mask: true }

    const img = new Image()
    const svgBlob = new Blob(
      [ICON_SVGS[key].replace(/currentColor/g, 'black')],
      { type: 'image/svg+xml' }
    )
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      ctx.drawImage(img, i * size, 0, size, size)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })

  return { iconAtlas: canvas, iconMapping: mapping }
}

export default function MapView() {
  const mapContainer = useRef(null)
  const deckCanvas = useRef(null)
  const mapRef = useRef(null)
  const deckRef = useRef(null)
  const atlasRef = useRef(null)
  const mappingRef = useRef(null)

  const tracks = useStore((s) => s.tracks)
  const currentTime = useStore((s) => s.currentTime)
  const tileProvider = useStore((s) => s.tileProvider)
  const mapCenter = useStore((s) => s.mapCenter)
  const mapZoom = useStore((s) => s.mapZoom)
  const trailMode = useStore((s) => s.trailMode)
  const trailWindowMinutes = useStore((s) => s.trailWindowMinutes)
  const iconSize = useStore((s) => s.iconSize)
  const setMapCenter = useStore((s) => s.setMapCenter)
  const setMapZoom = useStore((s) => s.setMapZoom)

  // アイコンアトラスを一度だけ生成
  useEffect(() => {
    const { iconAtlas, iconMapping } = buildIconAtlas(128)
    atlasRef.current = iconAtlas
    mappingRef.current = iconMapping
  }, [])

  // MapLibre 初期化
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: TILE_PROVIDERS[tileProvider]?.style || TILE_PROVIDERS.osm.style,
      center: [mapCenter.lon, mapCenter.lat],
      zoom: mapZoom,
      interactive: true,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')

    map.on('move', () => {
      const c = map.getCenter()
      setMapCenter({ lat: c.lat, lon: c.lng })
      setMapZoom(map.getZoom())
    })

    mapRef.current = map

    // Deck.gl 初期化
    const deck = new Deck({
      canvas: deckCanvas.current,
      initialViewState: {
        longitude: mapCenter.lon,
        latitude: mapCenter.lat,
        zoom: mapZoom,
      },
      controller: false,
      layers: [],
      onViewStateChange: ({ viewState }) => {
        map.jumpTo({
          center: [viewState.longitude, viewState.latitude],
          zoom: viewState.zoom,
          bearing: viewState.bearing,
          pitch: viewState.pitch,
        })
      },
    })

    deckRef.current = deck

    return () => {
      deck.finalize()
      map.remove()
      mapRef.current = null
      deckRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // タイル変更
  useEffect(() => {
    if (!mapRef.current) return
    const style = TILE_PROVIDERS[tileProvider]?.style || TILE_PROVIDERS.osm.style
    mapRef.current.setStyle(style)
  }, [tileProvider])

  // 外部からの地図センター・ズーム変更
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.jumpTo({
      center: [mapCenter.lon, mapCenter.lat],
      zoom: mapZoom,
    })
  }, [mapCenter, mapZoom])

  // レイヤー更新
  useEffect(() => {
    if (!deckRef.current) return

    const positions = getInterpolatedPositions(tracks, currentTime)

    // 軌跡レイヤー
    const trailLayers = tracks
      .filter((t) => t.visible)
      .map((track) => {
        const trail = getTrailPoints(track.points, currentTime, trailMode, trailWindowMinutes)
        if (trail.length < 2) return null
        const color = hexToRgb(track.color)
        return new PathLayer({
          id: `trail-${track.id}`,
          data: [trail],
          getPath: (d) => d.map((p) => [p.lon, p.lat]),
          getColor: [...color, 180],
          getWidth: 2,
          widthUnits: 'pixels',
          pickable: false,
        })
      })
      .filter(Boolean)

    // アイコンレイヤー
    const iconData = positions.map(({ track, point }) => ({
      position: [point.lon, point.lat],
      direction: point.direction,
      icon: track.iconType,
      color: hexToRgb(track.color),
      label: track.label,
    }))

    const iconLayer = atlasRef.current
      ? new IconLayer({
          id: 'icons',
          data: iconData,
          iconAtlas: atlasRef.current,
          iconMapping: mappingRef.current,
          getIcon: (d) => d.icon,
          getPosition: (d) => d.position,
          getAngle: (d) => -d.direction,
          getSize: iconSize,
          getColor: (d) => [...d.color, 255],
          pickable: true,
          billboard: false,
        })
      : new ScatterplotLayer({
          id: 'icons-fallback',
          data: iconData,
          getPosition: (d) => d.position,
          getFillColor: (d) => [...d.color, 220],
          getRadius: 8,
          radiusUnits: 'pixels',
          pickable: true,
        })

    const map = mapRef.current
    if (!map) return
    const center = map.getCenter()
    const zoom = map.getZoom()

    deckRef.current.setProps({
      layers: [...trailLayers, iconLayer],
      viewState: {
        longitude: center.lng,
        latitude: center.lat,
        zoom,
        bearing: 0,
        pitch: 0,
      },
    })
  }, [tracks, currentTime, trailMode, trailWindowMinutes, iconSize])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      <canvas
        ref={deckCanvas}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}
