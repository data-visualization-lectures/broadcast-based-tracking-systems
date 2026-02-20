'use client'
import { useEffect, useRef } from 'react'
import useStore from '@/app/store/useStore'

const SPEED_OPTIONS = [
  { label: '×1', value: 1 },
  { label: '×5', value: 5 },
  { label: '×10', value: 10 },
  { label: '×30', value: 30 },
  { label: '×100', value: 100 },
]

function formatUtc(ms) {
  if (!ms) return '--'
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

export default function TimelineControls() {
  const timeRange = useStore((s) => s.timeRange)
  const currentTime = useStore((s) => s.currentTime)
  const isPlaying = useStore((s) => s.isPlaying)
  const playbackSpeed = useStore((s) => s.playbackSpeed)
  const setCurrentTime = useStore((s) => s.setCurrentTime)
  const setIsPlaying = useStore((s) => s.setIsPlaying)
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed)

  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
      return
    }

    const tick = (now) => {
      if (lastTimeRef.current !== null) {
        const elapsed = now - lastTimeRef.current // ms (real time)
        const simElapsed = elapsed * playbackSpeed   // ms (sim time)
        setCurrentTime((prev) => {
          const next = prev + simElapsed
          if (next >= timeRange.end) {
            setIsPlaying(false)
            return timeRange.end
          }
          return next
        })
      }
      lastTimeRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, playbackSpeed, timeRange.end, setCurrentTime, setIsPlaying])

  const hasData = timeRange.end > timeRange.start
  const progress = hasData
    ? (currentTime - timeRange.start) / (timeRange.end - timeRange.start)
    : 0

  const handleSlider = (e) => {
    const ratio = Number(e.target.value) / 1000
    setCurrentTime(timeRange.start + (timeRange.end - timeRange.start) * ratio)
  }

  const handleReset = () => {
    setIsPlaying(false)
    setCurrentTime(timeRange.start)
  }

  return (
    <div className="bg-gray-900 border-t border-gray-700 px-4 py-3 space-y-2">
      {/* 時刻表示 */}
      <div className="text-center text-xs font-mono text-cyan-300">
        {formatUtc(currentTime)}
      </div>

      {/* スライダー */}
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(progress * 1000)}
        onChange={handleSlider}
        disabled={!hasData}
        className="w-full accent-cyan-400"
      />

      {/* コントロール */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1">
          {/* リセット */}
          <button
            onClick={handleReset}
            disabled={!hasData}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm disabled:opacity-40"
          >
            ⏮
          </button>
          {/* 再生/停止 */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!hasData}
            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold disabled:opacity-40"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>

        {/* 速度 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">速度:</span>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPlaybackSpeed(opt.value)}
              className={`px-2 py-0.5 rounded text-xs ${
                playbackSpeed === opt.value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
