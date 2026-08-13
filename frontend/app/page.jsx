'use client'
import { useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import DataUpload from '@/app/components/Sidebar/DataUpload'
import TrackList from '@/app/components/Sidebar/TrackList'
import MapSettings from '@/app/components/Sidebar/MapSettings'
import ExportPanel from '@/app/components/Export/ExportPanel'
import TimelineControls from '@/app/components/Timeline/TimelineControls'
import Accordion from '@/app/components/Sidebar/Accordion'
import useStore from '@/app/store/useStore'
import { parseCsv } from '@/app/utils/csvParser'
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

function getThumbnailDataUri() {
  try {
    const map = useStore.getState().mapInstance
    const canvas = map?.getCanvas?.()
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function PageContent() {
  const { t } = useI18n()
  const addTrack = useStore((s) => s.addTrack)
  const currentProjectIdRef = useRef(null)
  const currentProjectNameRef = useRef('')
  const loadedRouteIdRef = useRef(null)
  const showProcessingToast = useCallback((message) => {
    const header = document.querySelector('dataviz-tool-header')
    if (header && typeof header.showMessage === 'function') {
      header.showMessage(message, 'info', 5000)
    }
  }, [])
  const showToast = useCallback((message, type = 'info') => {
    const header = document.querySelector('dataviz-tool-header')
    if (header && typeof header.showMessage === 'function') {
      header.showMessage(message, type, 3000)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const applyProjectData = (projectData, meta = {}) => {
      useStore.getState().hydrateProject(projectData)
      if (meta.canOverwrite === false) {
        currentProjectIdRef.current = null
      } else if (meta.projectId) {
        currentProjectIdRef.current = meta.projectId
      }
      if (meta.projectName) currentProjectNameRef.current = meta.projectName
    }

    customElements.whenDefined('dataviz-tool-header').then(() => {
      if (cancelled) return
      const header = document.querySelector('dataviz-tool-header')
      if (!header) return

      header.setConfig({
        logo: {
          type: 'text',
          text: '✈ Broadcast Tracking System',
          textClass: 'font-bold text-lg text-white'
        },
        buttons: [
          {
            label: t('header.loadProject'),
            action: () => header.showLoadModal(),
            align: 'right',
          },
          {
            label: t('header.saveProject'),
            action: () => {
              const payload = useStore.getState().getProjectPayload()
              if (!payload.data.tracks.length) {
                showToast(t('toast.noDataToSave'), 'error')
                return
              }
              showProcessingToast(t('processing.savePrep'))
              header.showSaveModal({
                name: currentProjectNameRef.current || '',
                data: payload,
                thumbnailDataUri: getThumbnailDataUri(),
                existingProjectId: currentProjectIdRef.current,
              })
            },
            align: 'right',
          },
        ],
      })

      header.setProjectConfig({
        appName: 'bbts',
        toolName: 'Broadcast Tracking System',
        toolNameEn: 'Broadcast Tracking System',
        onProjectLoad: (projectData, meta = {}) => {
          applyProjectData(projectData, {
            projectId: meta.projectId,
            projectName: meta.projectName,
            canOverwrite: meta.canOverwrite,
          })
        },
        onProjectSave: (meta) => {
          currentProjectIdRef.current = meta.id
          currentProjectNameRef.current = meta.name || ''
        },
        onProjectDelete: (projectId) => {
          if (currentProjectIdRef.current === projectId) {
            currentProjectIdRef.current = null
          }
        },
      })

      header.setSampleConfig({
        toolId: 'bbts',
        onSampleSelect: async (detail) => {
          try {
            showProcessingToast(t('processing.sample'))
            const res = await fetch(detail.url)
            if (!res.ok) throw new Error('Failed to fetch sample')
            const text = await res.text()
            const tracks = parseCsv(text, detail.name || 'sample.csv')
            tracks.forEach((tr) => addTrack(tr))
          } catch (err) {
            console.error('Sample data load failed:', err)
          }
        }
      })

      const projectId = new URLSearchParams(window.location.search).get('projectId')
      if (!projectId || loadedRouteIdRef.current === projectId || typeof header.loadProject !== 'function') return
      loadedRouteIdRef.current = projectId
      header.loadProject(projectId).then((projectData) => {
        if (cancelled) return
        const context = header.getProjectContext?.() || {}
        applyProjectData(projectData, {
          projectId,
          projectName: context.projectName,
          canOverwrite: context.canOverwrite,
        })
      }).catch((error) => {
        console.error('Failed to load project from URL', error)
      })
    })

    return () => {
      cancelled = true
    }
  }, [addTrack, showProcessingToast, showToast, t])

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 104px)', marginTop: '104px' }}>
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
      <dataviz-tool-header></dataviz-tool-header>
      <PageContent />
    </I18nProvider>
  )
}
