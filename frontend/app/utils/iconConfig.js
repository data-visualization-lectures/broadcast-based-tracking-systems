// アイコン定義。SVGをbase64 URLとして返す
// Deck.gl IconLayer の getIcon で使用

export const ICON_OPTIONS_AIRCRAFT = [
  { value: 'airplane', labelKey: 'icon.airplane' },
  { value: 'small_plane', labelKey: 'icon.smallPlane' },
  { value: 'helicopter', labelKey: 'icon.helicopter' },
  { value: 'triangle', labelKey: 'icon.triangle' },
]

export const ICON_OPTIONS_VESSEL = [
  { value: 'ship', labelKey: 'icon.ship' },
  { value: 'small_boat', labelKey: 'icon.smallBoat' },
  { value: 'triangle', labelKey: 'icon.triangle' },
]

// SVG文字列を返す（色・サイズは Deck.gl 側で制御）
export const ICON_SVGS = {
  airplane: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
  </svg>`,
  small_plane: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 9.5c0-.83-.67-1.5-1.5-1.5h-5.76L10.5 2H9l2.25 6H5.5L4 6H2.5L3.5 9 2.5 12H4l1.5-2h5.75L9 16h1.5l4.24-6h5.76c.83 0 1.5-.67 1.5-1.5z"/>
  </svg>`,
  helicopter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.5 10h-2v5h2v-5zm12 0h-2v5h2v-5zm.5-2H13V5.73c.84-.34 1.46-1.1 1.46-2.02C14.46 2.76 13.7 2 12.73 2s-1.73.76-1.73 1.71c0 .92.62 1.68 1.46 2.02V8H5c-.55 0-1 .45-1 1s.45 1 1 1h14c.55 0 1-.45 1-1s-.45-1-1-1zM6 17h12l1 3H5l1-3z"/>
  </svg>`,
  ship: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
  </svg>`,
  small_boat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 20h16v2H4v-2zm0-4l8-2.91L20 16V8H4v8zm8-14a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
  </svg>`,
  triangle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 20h20L12 2z"/>
  </svg>`,
}

// SVGをDataURLに変換
export function svgToDataUrl(svgStr, color = '#ffffff') {
  const colored = svgStr.replace(/currentColor/g, color)
  const encoded = encodeURIComponent(colored)
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}

// Deck.gl IconLayer 用アイコンマッピングを生成
export function buildIconMapping(size = 64) {
  const mapping = {}
  Object.keys(ICON_SVGS).forEach((key) => {
    mapping[key] = { x: 0, y: 0, width: size, height: size, mask: true }
  })
  return mapping
}
