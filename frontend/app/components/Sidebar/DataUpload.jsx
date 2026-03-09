'use client'
import { useCallback, useState } from 'react'
import useStore from '@/app/store/useStore'
import { parseCsv } from '@/app/utils/csvParser'
import { useI18n } from '@/app/i18n'

const SAMPLE_FILES = [
  { id: 'g7_going', name: 'G7_Hiroshima_Zelensky_行き', labelKey: 'sample.g7_going' },
  { id: 'g7_return', name: 'G7_Hiroshima_Zelensky_帰り', labelKey: 'sample.g7_return' },
]

const ERROR_KEYS = {
  'データが空です': 'upload.emptyData',
}

export default function DataUpload() {
  const addTrack = useStore((s) => s.addTrack)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedSample, setSelectedSample] = useState('')
  const { t } = useI18n()

  const translateError = (msg) => {
    const key = ERROR_KEYS[msg]
    return key ? t(key) : msg
  }

  const processFiles = useCallback(
    async (files) => {
      setError(null)
      setLoading(true)
      try {
        for (const file of files) {
          const text = await file.text()
          const tracks = parseCsv(text, file.name)
          tracks.forEach((tr) => addTrack(tr))
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [addTrack]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.endsWith('.csv')
      )
      if (files.length === 0) {
        setError(t('upload.csvRequired'))
        return
      }
      processFiles(files)
    },
    [processFiles, t]
  )

  const onFileChange = (e) => {
    const files = Array.from(e.target.files)
    processFiles(files)
    e.target.value = ''
  }

  const loadSampleFile = async (sampleFile) => {
    try {
      setError(null)
      setLoading(true)
      const response = await fetch(`/samples/${sampleFile.name}.csv`)
      if (!response.ok) throw new Error(t('upload.fetchFailed'))
      const text = await response.text()
      const tracks = parseCsv(text, `${sampleFile.name}.csv`)
      tracks.forEach((tr) => addTrack(tr))
      setSelectedSample('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onSampleChange = (e) => {
    const selectedId = e.target.value
    if (!selectedId) return

    const sampleFile = SAMPLE_FILES.find(f => f.id === selectedId)
    if (sampleFile) {
      loadSampleFile(sampleFile)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('upload.heading')}</h3>
      <p className="text-xs text-gray-500">{t('upload.description')}</p>

      {/* ファイルアップロード */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-cyan-400 bg-cyan-900/20'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onClick={() => document.getElementById('file-input').click()}
      >
        <div className="text-2xl mb-1">📂</div>
        <p className="text-xs text-gray-400">
          {loading ? t('upload.loading') : t('upload.dropzone')}
        </p>
        <p className="text-xs text-gray-600 mt-1">{t('upload.compatible')}</p>
        <input
          id="file-input"
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={onFileChange}
          disabled={loading}
        />
      </div>

      {/* サンプルデータドロップダウン */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('upload.sampleData')}</label>
        <select
          value={selectedSample}
          onChange={onSampleChange}
          disabled={loading}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-500"
        >
          <option value="">{t('upload.sampleSelect')}</option>
          {SAMPLE_FILES.map((file) => (
            <option key={file.id} value={file.id}>
              {t(file.labelKey)}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">{translateError(error)}</p>
      )}
    </div>
  )
}
