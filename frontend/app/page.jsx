'use client'
import dynamic from 'next/dynamic'
import DataUpload from '@/app/components/Sidebar/DataUpload'
import TrackList from '@/app/components/Sidebar/TrackList'
import MapSettings from '@/app/components/Sidebar/MapSettings'
import ExportPanel from '@/app/components/Export/ExportPanel'
import TimelineControls from '@/app/components/Timeline/TimelineControls'
import Accordion from '@/app/components/Sidebar/Accordion'
import { I18nProvider, useI18n } from '@/app/i18n'

// MapLibre GL JS は SSR 非対応のため dynamic import
const MapView = dynamic(() => import('@/app/components/MapView/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <span className="text-gray-400 text-sm">Loading...</span>
    </div>
  ),
})

function LangToggle() {
  const { locale, setLocale } = useI18n()
  return (
    <button
      onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
      className="text-xs text-gray-500 hover:text-gray-300 border border-gray-600 rounded px-1.5 py-0.5"
    >
      {locale === 'ja' ? 'EN' : 'JA'}
    </button>
  )
}

function PageContent() {
  const { t } = useI18n()

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 48px)', marginTop: '48px' }}>
      {/* サイドバー */}
      <aside className="w-72 shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-cyan-400 tracking-wide">
              ✈ Broadcast Tracking System
            </h1>
            <LangToggle />
          </div>
          <p className="text-xs text-gray-500 mt-0.5"><a href="https://visualizing.jp/ads-b/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">ADS-B</a> / <a href="https://visualizing.jp/ais/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">AIS</a> {t('page.subtitle').replace('ADS-B / AIS ', '')}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <DataUpload />
          <TrackList />
          <Accordion title={t('page.mapSettings')} defaultOpen={true}>
            <MapSettings />
          </Accordion>
          <Accordion title={t('page.export')}>
            <ExportPanel />
          </Accordion>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-0 bg-black">
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <MapView />
        </div>
        <TimelineControls />
      </main>
    </div>
  )
}

export default function Page() {
  return (
    <I18nProvider>
      <PageContent />
    </I18nProvider>
  )
}
