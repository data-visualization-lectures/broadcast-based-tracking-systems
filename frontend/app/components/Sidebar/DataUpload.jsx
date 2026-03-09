'use client'
import { useCallback, useState } from 'react'
import useStore from '@/app/store/useStore'
import { parseCsv } from '@/app/utils/csvParser'

const SAMPLE_FILES = [
  { id: 'g7_going', name: 'G7_Hiroshima_Zelensky_行き', label: 'G7 広島へのゼレンスキーの航路（行き）' },
  { id: 'g7_return', name: 'G7_Hiroshima_Zelensky_帰り', label: 'G7 広島へのゼレンスキーの航路（帰り）' },
]

export default function DataUpload() {
  const addTrack = useStore((s) => s.addTrack)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedSample, setSelectedSample] = useState('')

  const processFiles = useCallback(
    async (files) => {
      setError(null)
      setLoading(true)
      try {
        for (const file of files) {
          const text = await file.text()
          const tracks = parseCsv(text, file.name)
          tracks.forEach((t) => addTrack(t))
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
        setError('CSVファイルを選択してください')
        return
      }
      processFiles(files)
    },
    [processFiles]
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
      if (!response.ok) throw new Error('ファイルの読み込みに失敗しました')
      const text = await response.text()
      const tracks = parseCsv(text, `${sampleFile.name}.csv`)
      tracks.forEach((t) => addTrack(t))
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
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">データ読み込み</h3>
      <p className="text-xs text-gray-500">緯度（lat）経度（lon）を含むCSVファイルに対応しています。</p>

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
          {loading ? '読み込み中...' : 'CSVをドロップ または クリックして選択'}
        </p>
        <p className="text-xs text-gray-600 mt-1">ADS-B / AIS 対応</p>
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
        <label className="text-xs text-gray-500 block mb-1">サンプルデータ</label>
        <select
          value={selectedSample}
          onChange={onSampleChange}
          disabled={loading}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-500"
        >
          <option value="">— サンプルを選択 —</option>
          {SAMPLE_FILES.map((file) => (
            <option key={file.id} value={file.id}>
              {file.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</p>
      )}
    </div>
  )
}
