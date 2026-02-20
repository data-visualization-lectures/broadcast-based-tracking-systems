'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Deck } from '@deck.gl/core'
import { PathLayer, IconLayer, ScatterplotLayer } from '@deck.gl/layers'
import useStore from '@/app/store/useStore'
import { TILE_PROVIDERS } from '@/app/utils/tileProviders'
import { getInterpolatedPositions, getTrailPoints } from '@/app/utils/geoUtils'
import { ICON_SVGS } from '@/app/utils/iconConfig'

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
    const blob = new Blob([ICON_SVGS[key].replace(/currentColor/g, 'black')], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    img.onload = () => { ctx.drawImage(img, i * size, 0, size, size); URL.revokeObjectURL(url) }
    img.src = url
  })
  return { iconAtlas: canvas, iconMapping: mapping }
}

export default function MapView() {
  const mapContainer = useRef(null)
  const mapRef       = useRef(null)
  const deckRef      = useRef(null)
  const atlasRef     = useRef(null)
  const mappingRef   = useRef(null)
  const progMoveRef  = useRef(false)

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

  useEffect(() => {
    const { iconAtlas, iconMapping } = buildIconAtlas(128)
    atlasRef.current   = iconAtlas
    mappingRef.current = iconMapping
  }, [])

  // MapLibre + Deck.gl 初期化
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: TILE_PROVIDERS[tileProvider]?.style || TILE_PROVIDERS.osm.style,
      center: [mapCenterLon, mapCenterLat],
      zoom: mapZoom,
      interactive: true,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')

    map.on('move', () => {
      if (progMoveRef.current) return
      const c = map.getCenter()
      setMapCenter({ lat: c.lat, lon: c.lng })
      setMapZoom(map.getZoom())
    })

    mapRef.current = map

    // Deck.gl: MapLibre の canvas の上に重ねる
    // glOptions.alpha=true + clearColor=[0,0,0,0] で透明にする
    map.on('load', () => {
      const deckCanvas = document.createElement('canvas')
      deckCanvas.style.position = 'absolute'
      deckCanvas.style.inset = '0'
      deckCanvas.style.pointerEvents = 'none'
      deckCanvas.style.background = 'transparent'
      mapContainer.current.appendChild(deckCanvas)

      const deck = new Deck({
        canvas: deckCanvas,
        width: '100%',
        height: '100%',
        controller: false,
        layers: [],
        glOptions: {
          alpha: true,
          premultipliedAlpha: true,
        },
        parameters: {
          clearColor: [0, 0, 0, 0],
        },
        onViewStateChange: () => {},
      })
      deckRef.current = deck

      // 初期レイヤーを描画
      syncDeck(deck, map, [], 0, 'full', 30, 32, null, null)
    })

    return () => {
      if (deckRef.current) { deckRef.current.finalize(); deckRef.current = null }
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // タイル変更
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setStyle(TILE_PROVIDERS[tileProvider]?.style || TILE_PROVIDERS.osm.style)
  }, [tileProvider])

  // サイドバーからのセンター・ズーム変更
  useEffect(() => {
    if (!mapRef.current) return
    progMoveRef.current = true
    mapRef.current.jumpTo({ center: [mapCenterLon, mapCenterLat], zoom: mapZoom })
    const id = setTimeout(() => { progMoveRef.current = false }, 200)
    return () => clearTimeout(id)
  }, [mapCenterLat, mapCenterLon, mapZoom])

  // Deck.gl レイヤー更新
  useEffect(() => {
    if (!deckRef.current || !mapRef.current) return
    syncDeck(
      deckRef.current,
      mapRef.current,
      tracks,
      currentTime,
      trailMode,
      trailWindowMinutes,
      iconSize,
      atlasRef.current,
      mappingRef.current,
    )
  }, [tracks, currentTime, trailMode, trailWindowMinutes, iconSize])

  return (
    <div
      ref={mapContainer}
      className="absolute inset-0"
    />
  )
}

// Deck.gl の viewState と layers を同期する純粋関数
function syncDeck(deck, map, tracks, currentTime, trailMode, trailWindowMinutes, iconSize, iconAtlas, iconMapping) {
  const positions = getInterpolatedPositions(tracks, currentTime)

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
        getColor: [...color, 200],
        getWidth: 2,
        widthUnits: 'pixels',
        pickable: false,
      })
    })
    .filter(Boolean)

  const iconData = positions.map(({ track, point }) => ({
    position: [point.lon, point.lat],
    direction: point.direction,
    icon: track.iconType,
    color: hexToRgb(track.color),
  }))

  const iconLayer = iconAtlas
    ? new IconLayer({
        id: 'icons',
        data: iconData,
        iconAtlas,
        iconMapping,
        getIcon: (d) => d.icon,
        getPosition: (d) => d.position,
        getAngle: (d) => -d.direction,
        getSize: iconSize,
        getColor: (d) => [...d.color, 255],
        billboard: false,
      })
    : new ScatterplotLayer({
        id: 'icons-fallback',
        data: iconData,
        getPosition: (d) => d.position,
        getFillColor: (d) => [...d.color, 220],
        getRadius: 8,
        radiusUnits: 'pixels',
      })

  const c = map.getCenter()
  deck.setProps({
    layers: [...trailLayers, iconLayer],
    viewState: {
      longitude: c.lng,
      latitude: c.lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    },
  })
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}
