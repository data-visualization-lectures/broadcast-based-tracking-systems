'use client'
import useStore from '@/app/store/useStore'
import { ICON_OPTIONS_AIRCRAFT, ICON_OPTIONS_VESSEL } from '@/app/utils/iconConfig'
import { useI18n } from '@/app/i18n'

export default function TrackList() {
  const tracks = useStore((s) => s.tracks)
  const updateTrack = useStore((s) => s.updateTrack)
  const removeTrack = useStore((s) => s.removeTrack)
  const { t } = useI18n()

  if (tracks.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-4">
        {t('track.noData')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {t('track.heading')} ({tracks.length})
      </h3>
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {tracks.map((track) => {
          const iconOptions =
            track.type === 'aircraft' ? ICON_OPTIONS_AIRCRAFT : ICON_OPTIONS_VESSEL
          return (
            <div
              key={track.id}
              className="bg-gray-800 rounded-lg px-3 py-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                {/* 可視切替 */}
                <input
                  type="checkbox"
                  checked={track.visible}
                  onChange={(e) =>
                    updateTrack(track.id, { visible: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
                {/* カラーピッカー */}
                <input
                  type="color"
                  value={track.color}
                  onChange={(e) =>
                    updateTrack(track.id, { color: e.target.value })
                  }
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                {/* ラベル */}
                <span className="text-xs text-white font-mono flex-1 truncate">
                  {track.label}
                </span>
                {/* 種別バッジ */}
                <span className="text-xs text-gray-500 shrink-0">
                  {track.type === 'aircraft' ? '✈' : '🚢'}
                </span>
                {/* 削除 */}
                <button
                  onClick={() => removeTrack(track.id)}
                  className="text-gray-600 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
              {/* アイコン選択 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 shrink-0">{t('track.icon')}</span>
                <select
                  value={track.iconType}
                  onChange={(e) =>
                    updateTrack(track.id, { iconType: e.target.value })
                  }
                  className="flex-1 bg-gray-700 text-xs text-white rounded px-1 py-0.5 border border-gray-600"
                >
                  {iconOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              {/* ポイント数 */}
              <div className="text-xs text-gray-600">
                {track.points.length.toLocaleString()} {t('track.points')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
