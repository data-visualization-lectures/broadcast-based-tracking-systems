'use client'
import useStore from '@/app/store/useStore'
import { TILE_PROVIDERS } from '@/app/utils/tileProviders'

export default function MapSettings() {
  const tileProvider = useStore((s) => s.tileProvider)
  const mapCenter = useStore((s) => s.mapCenter)
  const mapZoom = useStore((s) => s.mapZoom)
  const trailMode = useStore((s) => s.trailMode)
  const trailWindowMinutes = useStore((s) => s.trailWindowMinutes)
  const iconSize = useStore((s) => s.iconSize)
  const setTileProvider = useStore((s) => s.setTileProvider)
  const setMapCenter = useStore((s) => s.setMapCenter)
  const setMapZoom = useStore((s) => s.setMapZoom)
  const setTrailMode = useStore((s) => s.setTrailMode)
  const setTrailWindowMinutes = useStore((s) => s.setTrailWindowMinutes)
  const setIconSize = useStore((s) => s.setIconSize)
  const fitAll = useStore((s) => s.fitAll)

  return (
    <div className="space-y-3">
      {/* タイル選択 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">ベースマップ</label>
        <select
          value={tileProvider}
          onChange={(e) => setTileProvider(e.target.value)}
          className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
        >
          {Object.entries(TILE_PROVIDERS).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>
      </div>

      {/* ズームレベル（MapLibre zoom: 0=世界全体, 22=建物レベル） */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          ズームレベル: <span className="text-white font-mono">{mapZoom.toFixed(1)}</span>
          <span className="text-gray-600 ml-1 text-xs">（0: 世界 ↔ 22: 建物）</span>
        </label>
        <input
          type="range"
          min={0}
          max={22}
          step={0.5}
          value={mapZoom}
          onChange={(e) => setMapZoom(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>

      {/* 緯度経度 */}
      <div className="grid grid-cols-2 gap-1">
        <div>
          <label className="text-xs text-gray-400 block mb-0.5">緯度</label>
          <input
            type="number"
            value={mapCenter.lat.toFixed(4)}
            step={0.01}
            onChange={(e) =>
              setMapCenter({ ...mapCenter, lat: Number(e.target.value) })
            }
            className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-0.5">経度</label>
          <input
            type="number"
            value={mapCenter.lon.toFixed(4)}
            step={0.01}
            onChange={(e) =>
              setMapCenter({ ...mapCenter, lon: Number(e.target.value) })
            }
            className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
          />
        </div>
      </div>

      {/* 全体表示 */}
      <button
        onClick={fitAll}
        className="w-full py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-white"
      >
        全データにフィット
      </button>

      {/* 軌跡モード */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">軌跡表示</label>
        <select
          value={trailMode}
          onChange={(e) => setTrailMode(e.target.value)}
          className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
        >
          <option value="full">全軌跡を表示</option>
          <option value="window">直近 N 分のみ</option>
          <option value="none">非表示</option>
        </select>
        {trailMode === 'window' && (
          <div className="mt-1">
            <label className="text-xs text-gray-400 block mb-0.5">
              表示時間: {trailWindowMinutes} 分
            </label>
            <input
              type="range"
              min={1}
              max={120}
              value={trailWindowMinutes}
              onChange={(e) => setTrailWindowMinutes(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        )}
      </div>

      {/* アイコンサイズ */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          アイコンサイズ: {iconSize}px
        </label>
        <input
          type="range"
          min={16}
          max={64}
          value={iconSize}
          onChange={(e) => setIconSize(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>
    </div>
  )
}
