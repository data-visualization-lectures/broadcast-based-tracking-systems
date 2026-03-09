'use client'
import useStore from '@/app/store/useStore'
import { TILE_PROVIDERS } from '@/app/utils/tileProviders'
import { useI18n } from '@/app/i18n'

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
  const { t } = useI18n()

  return (
    <div className="space-y-3">
      {/* タイル選択 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">{t('map.basemap')}</label>
        <select
          value={tileProvider}
          onChange={(e) => setTileProvider(e.target.value)}
          className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
        >
          {Object.entries(TILE_PROVIDERS).map(([key, val]) => (
            <option key={key} value={key}>
              {val.labelKey ? t(val.labelKey) : val.label}
            </option>
          ))}
        </select>
      </div>

      {/* ズームレベル */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          {t('map.zoom')}: <span className="text-white font-mono">{mapZoom.toFixed(1)}</span>
          <span className="text-gray-600 ml-1 text-xs">{t('map.zoomRange')}</span>
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
          <label className="text-xs text-gray-400 block mb-0.5">{t('map.lat')}</label>
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
          <label className="text-xs text-gray-400 block mb-0.5">{t('map.lon')}</label>
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
        {t('map.fitAll')}
      </button>

      {/* 軌跡モード */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">{t('map.trail')}</label>
        <select
          value={trailMode}
          onChange={(e) => setTrailMode(e.target.value)}
          className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
        >
          <option value="full">{t('map.trailFull')}</option>
          <option value="window">{t('map.trailWindow')}</option>
          <option value="none">{t('map.trailNone')}</option>
        </select>
        {trailMode === 'window' && (
          <div className="mt-1">
            <label className="text-xs text-gray-400 block mb-0.5">
              {t('map.trailDuration')}: {trailWindowMinutes} {t('map.trailMinutes')}
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
          {t('map.iconSize')}: {iconSize}px
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
