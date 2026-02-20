'use client'
import { useCallback, useState } from 'react'
import useStore from '@/app/store/useStore'
import { parseCsv } from '@/app/utils/csvParser'

export default function DataUpload() {
  const addTrack = useStore((s) => s.addTrack)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">データ読み込み</h3>
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
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</p>
      )}
    </div>
  )
}
