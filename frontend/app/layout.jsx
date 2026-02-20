import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'

export const metadata = {
  title: 'Broadcast Tracking System',
  description: 'ADS-B / AIS 移動データ可視化ツール',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
