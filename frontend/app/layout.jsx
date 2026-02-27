import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import Script from 'next/script'

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
      <Script src="https://auth.dataviz.jp/lib/supabase.js" strategy="beforeInteractive" />
      <Script src="https://auth.dataviz.jp/lib/dataviz-auth-client.js" strategy="afterInteractive" />
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
