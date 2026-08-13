import { create } from 'zustand'

const COLORS = [
  '#ffffff', '#ef4444', '#3b82f6', '#22c55e',
  '#f59e0b', '#a855f7', '#ec4899', '#06b6d4',
]

let colorIndex = 0
const nextColor = () => COLORS[colorIndex++ % COLORS.length]

const useStore = create((set, get) => ({
  // データ
  tracks: [],

  // タイムライン
  timeRange: { start: 0, end: 0 },
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 10,

  // 地図
  mapCenter: { lat: 35.0, lon: 135.0 },
  mapZoom: 4,
  tileProvider: 'esri_satellite',

  // 表示設定
  trailMode: 'full',
  trailWindowMinutes: 30,
  iconSize: 32,

  // エクスポート
  exportMethod: 'client-gif',
  exportFps: 5,
  exportWidth: 720,
  exportDrawDatetime: false,
  exportDatetimeMode: 'utc',

  // MapLibre インスタンス（エクスポート用キャプチャに使用）
  mapInstance: null,

  // アクション
  addTrack: (track) => {
    const color = nextColor()
    const newTrack = { ...track, color, visible: true }
    set((s) => {
      const tracks = [...s.tracks, newTrack]
      const allPoints = tracks.flatMap((t) => t.points)
      if (allPoints.length === 0) return { tracks }
      const times = allPoints.map((p) => p.t)
      const start = Math.min(...times)
      const end = Math.max(...times)
      // 地図中心を全データの中心に
      const lats = allPoints.map((p) => p.lat)
      const lons = allPoints.map((p) => p.lon)
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
      const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2
      return {
        tracks,
        timeRange: { start, end },
        currentTime: start,
        mapCenter: { lat: centerLat, lon: centerLon },
      }
    })
  },

  removeTrack: (id) =>
    set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) })),

  updateTrack: (id, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  setCurrentTime: (t) =>
    set((s) => ({ currentTime: typeof t === 'function' ? t(s.currentTime) : t })),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
  setMapCenter: (c) => set({ mapCenter: c }),
  setMapZoom: (z) => set({ mapZoom: z }),
  setTileProvider: (p) => set({ tileProvider: p }),
  setTrailMode: (m) => set({ trailMode: m }),
  setTrailWindowMinutes: (n) => set({ trailWindowMinutes: n }),
  setIconSize: (n) => set({ iconSize: n }),
  setExportMethod: (m) => set({ exportMethod: m }),
  setExportFps: (n) => set({ exportFps: n }),
  setExportWidth: (n) => set({ exportWidth: n }),
  setExportDrawDatetime: (v) => set({ exportDrawDatetime: v }),
  setExportDatetimeMode: (m) => set({ exportDatetimeMode: m }),
  setMapInstance: (map) => set({ mapInstance: map }),

  fitAll: () => {
    const { tracks } = get()
    const allPoints = tracks.flatMap((t) => t.points)
    if (allPoints.length === 0) return
    const lats = allPoints.map((p) => p.lat)
    const lons = allPoints.map((p) => p.lon)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const centerLat = (minLat + maxLat) / 2
    const centerLon = (minLon + maxLon) / 2
    const latDiff = maxLat - minLat
    const lonDiff = maxLon - minLon
    const diff = Math.max(latDiff, lonDiff)
    let zoom = 4
    if (diff < 0.01) zoom = 14
    else if (diff < 0.1) zoom = 11
    else if (diff < 1) zoom = 8
    else if (diff < 5) zoom = 6
    else if (diff < 20) zoom = 4
    else zoom = 3
    set({ mapCenter: { lat: centerLat, lon: centerLon }, mapZoom: zoom })
  },

  getProjectPayload: () => {
    const s = get()
    return {
      version: 1,
      chartType: 'bbts',
      data: {
        tracks: s.tracks.map((track) => ({
          id: track.id,
          label: track.label,
          type: track.type,
          iconType: track.iconType,
          color: track.color,
          visible: track.visible,
          points: track.points,
        })),
      },
      settings: {
        mapCenter: s.mapCenter,
        mapZoom: s.mapZoom,
        tileProvider: s.tileProvider,
        trailMode: s.trailMode,
        trailWindowMinutes: s.trailWindowMinutes,
        iconSize: s.iconSize,
        playbackSpeed: s.playbackSpeed,
        currentTime: s.currentTime,
        exportMethod: s.exportMethod,
        exportFps: s.exportFps,
        exportWidth: s.exportWidth,
        exportDrawDatetime: s.exportDrawDatetime,
        exportDatetimeMode: s.exportDatetimeMode,
      },
    }
  },

  hydrateProject: (payload) => {
    const tracks = Array.isArray(payload?.data?.tracks)
      ? payload.data.tracks
      : Array.isArray(payload?.tracks)
        ? payload.tracks
        : []
    const settings = payload?.settings && typeof payload.settings === 'object' ? payload.settings : {}
    const allPoints = tracks.flatMap((track) => (Array.isArray(track.points) ? track.points : []))
    const times = allPoints.map((point) => point.t).filter((value) => Number.isFinite(value))
    const start = times.length ? Math.min(...times) : 0
    const end = times.length ? Math.max(...times) : 0
    const requestedTime = Number(settings.currentTime)
    const currentTime = Number.isFinite(requestedTime)
      ? Math.min(Math.max(requestedTime, start), end || requestedTime)
      : start
    const mapCenter = settings.mapCenter && Number.isFinite(settings.mapCenter.lat) && Number.isFinite(settings.mapCenter.lon)
      ? { lat: settings.mapCenter.lat, lon: settings.mapCenter.lon }
      : { lat: 35.0, lon: 135.0 }

    set({
      tracks,
      timeRange: { start, end },
      currentTime,
      isPlaying: false,
      playbackSpeed: Number.isFinite(settings.playbackSpeed) ? settings.playbackSpeed : 10,
      mapCenter,
      mapZoom: Number.isFinite(settings.mapZoom) ? settings.mapZoom : 4,
      tileProvider: settings.tileProvider || 'esri_satellite',
      trailMode: settings.trailMode || 'full',
      trailWindowMinutes: Number.isFinite(settings.trailWindowMinutes) ? settings.trailWindowMinutes : 30,
      iconSize: Number.isFinite(settings.iconSize) ? settings.iconSize : 32,
      exportMethod: settings.exportMethod || 'client-gif',
      exportFps: Number.isFinite(settings.exportFps) ? settings.exportFps : 5,
      exportWidth: Number.isFinite(settings.exportWidth) ? settings.exportWidth : 720,
      exportDrawDatetime: Boolean(settings.exportDrawDatetime),
      exportDatetimeMode: settings.exportDatetimeMode || 'utc',
    })
  },
}))

export default useStore
