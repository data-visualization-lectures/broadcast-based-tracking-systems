'use client'
import dynamic from 'next/dynamic'
import DataUpload from '@/app/components/Sidebar/DataUpload'
import TrackList from '@/app/components/Sidebar/TrackList'
import MapSettings from '@/app/components/Sidebar/MapSettings'
import ExportPanel from '@/app/components/Export/ExportPanel'
import TimelineControls from '@/app/components/Timeline/TimelineControls'

// MapLibre GL JS は SSR 非対応のため dynamic import
const MapView = dynamic(() => import('@/app/components/MapView/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <span className="text-gray-400 text-sm">地図を読み込み中...</span>
    </div>
  ),
})

export default function Page() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* サイドバー */}
      <aside className="w-72 shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h1 className="text-sm font-bold text-cyan-400 tracking-wide">
            ✈ Broadcast Tracking System
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">ADS-B / AIS 可視化</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <DataUpload />
          <TrackList />
          <MapSettings />
          <ExportPanel />
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 地図 */}
        <div className="flex-1 relative">
          <MapView />
        </div>
        {/* タイムライン */}
        <TimelineControls />
      </main>
    </div>
  )
}
