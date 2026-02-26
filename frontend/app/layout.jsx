import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'

export const metadata = {
  title: 'Broadcast Tracking System',
  description: 'ADS-B / AIS 移動データ可視化ツール',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-97TS0ZTLV0"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-97TS0ZTLV0');
            `,
          }}
        />
      </head>
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
