# Broadcast-Based Tracking System — 実装計画

## 概要

ADS-B（航空機）・AIS（船舶）の移動データを地図上で時系列アニメーション表示し、
GIF / 連番PNG としてエクスポートできる Web ツール。

---

## システム構成

```
┌──────────────────────────────────────┐
│         Frontend (Next.js)            │
│         → Vercel にデプロイ            │
│                                       │
│  MapLibre GL JS  ＋  Deck.gl          │
│  クライアントサイドでデータ解析・描画   │
│  gif.js でクライアントGIF生成          │
└────────────────┬─────────────────────┘
                 │ REST API (HTTPS)
                 │ ※重いエクスポートのみ
┌────────────────▼─────────────────────┐
│         Backend (FastAPI)             │
│         → Railway にデプロイ           │
│                                       │
│  Pillow + imageio  →  GIF 生成        │
│  zipfile             →  PNG ZIP 生成   │
└──────────────────────────────────────┘
```

**基本方針:** データ解析・地図描画・アニメーション再生はすべてクライアントサイドで完結。
エクスポート（GIF/ZIP）の重い処理のみ Railway バックエンドに委譲する。

---

## 技術スタック

### フロントエンド（Vercel）

| 役割 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js 14 (App Router) | |
| 言語 | JavaScript (JSX) | TypeScript 不使用 |
| 地図 | MapLibre GL JS | OSS・WebGL・複数タイル対応 |
| データ描画 | Deck.gl (IconLayer, PathLayer, ScatterplotLayer) | 数万点でも高速 |
| UIコンポーネント | shadcn/ui + Tailwind CSS | |
| 状態管理 | Zustand | シンプルな全体状態 |
| ファイル解析 | PapaParse (CSV) + ネイティブ JSON.parse | |
| GIF 生成 | gif.js (クライアントサイド) | サーバ負荷ゼロ |

### バックエンド（Railway）

| 役割 | 採用技術 |
|---|---|
| フレームワーク | FastAPI |
| GIF 生成 | Pillow + imageio |
| ZIP 生成 | Python 標準 zipfile |
| CORS | fastapi.middleware.cors |

---

## 入力データ仕様

### サンプルデータから確認した実際のフォーマット

サンプル: `G7_Hiroshima_Zelensky_行き.csv` / `G7_Hiroshima_Zelensky_帰り.csv`

```csv
Timestamp,UTC,Callsign,Position,Altitude,Speed,Direction
1684515906,2023-05-19T17:05:06Z,CTM1022,"21.66923,39.136734",0,0,250
1684516104,2023-05-19T17:08:24Z,CTM1022,"21.669287,39.136936",0,2,250
```

| カラム名 | 型 | 内容 | 備考 |
|---|---|---|---|
| `Timestamp` | int | Unix タイムスタンプ（秒） | |
| `UTC` | string | ISO 8601 UTC 時刻 | `Timestamp` と冗長。パースには `Timestamp` を使用 |
| `Callsign` | string | 便名 / コールサイン | 機体識別に使用 |
| `Position` | string | `"lat,lon"` のクォート済み複合フィールド | **要注意: カンマ区切りの中にカンマが含まれる** |
| `Altitude` | int | 高度 (ft) | |
| `Speed` | int | 対地速度 (kt) | |
| `Direction` | int | 進行方向 degrees (0-360) | アイコン回転に使用 |

#### Position フィールドの注意点

`Position` は `"lat,lon"` という形式でクォートされた1フィールド。
PapaParse はデフォルトで正しく扱うが、パース後に分割処理が必要。

```javascript
// パース例
const [lat, lon] = row.Position.split(',').map(Number)
// "21.66923,39.136734" → lat=21.66923, lon=39.136734
```

### AIS（船舶）— 今後追加予定

実データが確認でき次第カラム定義を確定。基本構成は以下を想定:

| カラム名 | 内容 |
|---|---|
| `Timestamp` | Unix タイムスタンプ（秒）|
| `UTC` | ISO 8601 UTC 時刻 |
| `MMSI` | 船舶識別番号 |
| `VesselName` | 船名 |
| `Position` | `"lat,lon"` （ADS-B と同形式を想定） |
| `Speed` | 速力 (kt) |
| `Course` | 針路 degrees |

**種別自動判定ロジック:** カラム名に `Callsign` → ADS-B、`MMSI` / `VesselName` → AIS。
判定不能の場合はユーザーが手動選択。

---

## 機能仕様

### 1. データ入力

- CSV / JSON ファイルのドラッグ＆ドロップまたはファイル選択
- 複数ファイルの同時読み込み（複数機体・複数船舶）
- 読み込み後、機体/船舶ごとにリスト表示・個別オン/オフ切替
- 大量データ（数十万点）: Web Worker で非同期パース

### 2. 地図表示

- ベースマップタイル選択（ドロップダウン）:
  - OpenStreetMap
  - CartoDB Positron（明るい）
  - CartoDB Dark Matter（暗い）
  - Stadia Alidade Smooth Dark
  - ESRI World Imagery（衛星）
  - 地理院タイル 標準地図（日本国内向け）
- ズームレベル・中心座標をコントロールパネルから数値入力可能
- 「全データにフィット」ボタン（全軌跡が収まるよう自動ズーム）
- 軌跡の表示/非表示・色選択（機体/船舶ごと）

### 3. アイコン設定

- アイコン種別の選択（機体/船舶ごとに設定可能）:
  - 航空機: ✈ 旅客機 / ✈ 小型機 / 🚁 ヘリコプター / ▲ シンプル三角
  - 船舶: 🚢 大型船 / ⛵ 小型船 / 🛥 タンカー / ▲ シンプル三角
- `track` / `course` フィールドがあれば進行方向に合わせて自動回転
- アイコンサイズ調整（スライダー）
- アイコン色設定

### 4. タイムライン・再生コントロール

- 時刻スライダー（ドラッグで任意時刻にシーク）
- 現在時刻の表示（UTC / ローカル切替）
- 再生 / 一時停止 / リセット ボタン
- 再生速度選択: ×1, ×5, ×10, ×30, ×100（リアルタイム比）
- ループ再生オプション
- 軌跡の表示モード:
  - 全軌跡を常に表示
  - 過去 N 分の軌跡のみ表示（フェードアウト）
  - アイコンのみ（軌跡非表示）

### 5. エクスポート（アニメーション出力）

#### 方式 1: クライアントサイド GIF（推奨・デフォルト）

- gif.js がブラウザ上でフレームを合成
- 設定: FPS（1/2/5/10）、幅（480/720/1080px）
- 生成完了後、ダウンロードダイアログ
- サーバ不要・無料・プライバシー安全

#### 方式 2: サーバサイド GIF（Railway）

- 各フレームの PNG を一括送信 → Railway が Pillow/imageio で GIF 合成
- 品質はクライアントと同等だが大規模データに向く
- 設定: FPS、幅、ループ回数

#### 方式 3: 連番 PNG ZIP ダウンロード

- 各フレームを PNG でエクスポート → ZIP で返却
- 最も確実・最も汎用的
- ffmpeg で動画変換する際のフォールバック素材としても使用可能

#### エクスポート設定 UI

```
[ エクスポート設定 ]
  方式: ○ クライアントGIF  ○ サーバGIF  ○ 連番PNG ZIP
  FPS:  [ 1 | 2 | 5 | 10 ]
  幅:   [ 480px | 720px | 1080px ]
  範囲: ○ 全期間  ○ 現在表示中の範囲
  [ エクスポート開始 ]
```

---

## API 設計（バックエンド）

### `POST /api/export/gif`

```
Request (multipart/form-data or JSON):
  frames: [base64 PNG, ...]   // 各フレーム画像
  fps: int                    // FPS
  loop: int                   // 0 = 無限ループ

Response:
  Content-Type: image/gif
  (バイナリ GIF データ)
```

### `POST /api/export/zip`

```
Request (JSON):
  frames: [base64 PNG, ...]   // 各フレーム画像
  filename_prefix: str

Response:
  Content-Type: application/zip
  (バイナリ ZIP データ)
```

### `GET /api/health`

```
Response: { "status": "ok" }
```

---

## ディレクトリ構成

```
broadcast-based-tracking-systems/
├── frontend/                          # Next.js → Vercel
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.jsx
│   │   │   └── page.jsx               # メインページ
│   │   ├── components/
│   │   │   ├── MapView/
│   │   │   │   ├── MapView.jsx        # MapLibre + Deck.gl 統合
│   │   │   │   ├── IconLayer.jsx      # アイコン描画
│   │   │   │   └── PathLayer.jsx      # 軌跡描画
│   │   │   ├── Timeline/
│   │   │   │   ├── TimelineSlider.jsx
│   │   │   │   └── PlaybackControls.jsx
│   │   │   ├── Sidebar/
│   │   │   │   ├── DataUpload.jsx     # ファイル読み込み
│   │   │   │   ├── TrackList.jsx      # 機体/船舶リスト
│   │   │   │   ├── IconSelector.jsx   # アイコン設定
│   │   │   │   ├── TileSelector.jsx   # タイル選択
│   │   │   │   └── MapControls.jsx    # ズーム/中心座標
│   │   │   └── Export/
│   │   │       └── ExportPanel.jsx    # エクスポート設定・実行
│   │   ├── hooks/
│   │   │   ├── usePlayback.js         # 再生状態管理
│   │   │   ├── useDataParser.js       # CSV/JSONパース（Web Worker）
│   │   │   └── useExport.js           # GIF/ZIP生成
│   │   ├── store/
│   │   │   └── useStore.js            # Zustand グローバル状態
│   │   ├── utils/
│   │   │   ├── adsbParser.js          # ADS-B CSV解析
│   │   │   ├── aisParser.js           # AIS CSV解析
│   │   │   ├── geoUtils.js            # 座標計算・バウンディングボックス
│   │   │   └── iconConfig.js          # アイコン定義・SVG
│   │   └── workers/
│   │       └── dataParser.worker.js   # Web Worker でパース
│   ├── public/
│   │   └── icons/                     # アイコン SVG
│   ├── package.json
│   ├── next.config.mjs
│   └── tailwind.config.js
│
├── backend/                           # FastAPI → Railway
│   ├── main.py
│   ├── routers/
│   │   └── export.py                  # /api/export/*
│   ├── utils/
│   │   ├── gif_generator.py
│   │   └── zip_generator.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.toml
│
├── PLAN.md                            # 本ファイル
└── README.md
```

---

## 状態管理（Zustand store）

```javascript
{
  // データ
  tracks: [                        // 読み込み済み軌跡リスト
    {
      id: string,
      type: 'aircraft' | 'vessel',
      label: string,               // callsign / vessel_name
      points: [{ t, lat, lon, track }],
      visible: boolean,
      color: string,
      iconType: string,
    }
  ],

  // タイムライン
  timeRange: { start, end },       // 全データの時間範囲
  currentTime: number,             // 現在の再生時刻 (Unix ms)
  isPlaying: boolean,
  playbackSpeed: number,           // 再生倍率

  // 地図
  mapCenter: { lat, lon },
  mapZoom: number,
  tileProvider: string,

  // 表示設定
  trailMode: 'full' | 'window' | 'none',
  trailWindowMinutes: number,
  iconSize: number,

  // エクスポート
  exportMethod: 'client-gif' | 'server-gif' | 'zip',
  exportFps: number,
  exportWidth: number,
}
```

---

## デプロイ構成

### Vercel（フロントエンド）

```
- フレームワーク: Next.js
- ビルドコマンド: npm run build
- 出力ディレクトリ: .next
- 環境変数:
    NEXT_PUBLIC_BACKEND_URL=https://your-app.railway.app
```

### Railway（バックエンド）

```
- Dockerfile ベースでデプロイ
- ポート: 8000
- 環境変数:
    ALLOWED_ORIGINS=https://your-app.vercel.app
- 料金: Hobby Plan $5/月 〜
```

---

## 実装フェーズ

### Phase 1: コア機能（MVP）

- [ ] プロジェクトセットアップ（Next.js + FastAPI）
- [ ] データ読み込み・パース（ADS-B/AIS CSV）
- [ ] MapLibre GL JS 地図表示
- [ ] Deck.gl IconLayer でアイコン描画（静止）
- [ ] タイムスライダー実装
- [ ] 再生/停止コントロール
- [ ] Vercel + Railway へのデプロイ確認

### Phase 2: 地図・表示の充実

- [ ] タイルプロバイダ切替
- [ ] Deck.gl PathLayer で軌跡描画
- [ ] アイコン選択・回転（進行方向）
- [ ] 機体/船舶リスト（個別オン/オフ）
- [ ] 再生速度切替
- [ ] 「全データにフィット」ボタン

### Phase 3: エクスポート機能

- [ ] クライアントサイド GIF（gif.js）
- [ ] 連番 PNG ZIP（Railway）
- [ ] エクスポート設定 UI（FPS・幅・範囲）
- [ ] プログレスバー

### Phase 4: 大規模データ対応・UX 改善

- [ ] Web Worker でのパース（UI ブロック回避）
- [ ] 軌跡フェードアウト（直近 N 分のみ表示）
- [ ] 複数ファイル同時読み込み
- [ ] 設定の保存（localStorage）
- [ ] JSON 形式の読み込み対応
- [ ] **Deck.gl 統合（数十万点規模のデータ対応）** ← 下記参照

---

## 描画エンジンの現状と Deck.gl 移行方針

### 現在の実装（MapLibre ネイティブ）

| 役割 | 実装 | 上限目安 |
|---|---|---|
| 軌跡描画 | MapLibre GeoJSON source + line layer | 数千〜数万点 |
| アイコン描画 | `maplibregl.Marker`（HTML要素） | 数十機体まで |

シンプルで確実に動作するが、数十万点・数百機体の規模ではパフォーマンスが低下する。

### 将来: Deck.gl への移行（Phase 4）

大量データが必要になった段階で Deck.gl を導入する。
その際は **`@deck.gl/maplibre`** の公式連携モジュールを使用する。

```
npm install @deck.gl/core @deck.gl/layers @deck.gl/maplibre
```

```javascript
// MapLibreOverlay を使う方式（透明化問題が発生しない公式推奨方法）
import { MapboxOverlay } from '@deck.gl/maplibre'
import { PathLayer, IconLayer } from '@deck.gl/layers'

// MapLibre の map インスタンスに Deck.gl をオーバーレイとして追加
const overlay = new MapboxOverlay({ layers: [...] })
map.addControl(overlay)

// レイヤー更新
overlay.setProps({ layers: [trailLayer, iconLayer] })
```

#### なぜ以前の方法（`new Deck({ canvas })`）は失敗したか

- Deck.gl が生成する WebGL コンテキストはデフォルトで不透明
- `glOptions: { alpha: true }` + `clearColor: [0,0,0,0]` を設定しても
  ブラウザの compositing 上の問題で MapLibre タイルが見えなかった
- `@deck.gl/maplibre` の `MapboxOverlay` はこの問題を内部で解決している

#### 移行時の性能目安

| レイヤー | データ規模 | FPS |
|---|---|---|
| PathLayer（軌跡） | 100万点 | 60fps |
| IconLayer（アイコン） | 1万機体 | 60fps |

---

## FFmpeg 動画化の将来対応について

### Railway での FFmpeg 実装は可能

Railway は Docker ベースのプラットフォームのため、`Dockerfile` に `apt-get install ffmpeg` を追記するだけで
FFmpeg を利用できる。Vercel のサーバレス関数（タイムアウト制限あり）とは異なり、
**Railway はコンテナが動き続ける**ため、数分かかる動画エンコードも問題なく実行できる。

```dockerfile
# backend/Dockerfile（将来的な追加イメージ）
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
# ... 以降は通常のFastAPIセットアップ
```

### 実装フロー（将来実装時）

```
1. フロントエンドが各フレームPNGをRailwayに送信
   （またはRailway上でMatplotlib/Pillowでフレームを直接生成）

2. Railway の /api/export/mp4 エンドポイントが
   一時ディレクトリにPNGを保存

3. FFmpegコマンドで連番PNG → MP4 に変換
   ffmpeg -r {fps} -i frame_%04d.png -vcodec libx264 -pix_fmt yuv420p output.mp4

4. MP4バイナリをレスポンスとして返却 → フロントエンドでダウンロード
```

### スペック上の注意点

| 項目 | 内容 |
|---|---|
| Railway メモリ | Starter: 512MB / Pro: 8GB。HD動画（1080p）はメモリ消費大きい |
| エンコード時間 | CPU性能依存。30秒×10FPS（300フレーム）で数十秒〜数分 |
| 一時ファイル | Railway のディスクはコンテナ内に一時保存可能。永続化は別途Volume設定が必要 |
| 同時リクエスト | 複数ユーザーが同時にエクスポートすると競合リスク → ジョブキュー（Celery等）で対処可能 |

**結論: Railway での FFmpeg 動画化は技術的に問題なく実現可能。** Phase 4 以降の拡張として追加予定。

---

## 注意事項・制約

| 項目 | 内容 |
|---|---|
| Vercel 無料枠 | サーバレス関数 10秒タイムアウト → 重いGIF/動画生成はRailwayへ |
| Railway 無料枠 | $5クレジット/月。GIF・FFmpeg生成はリソース消費に注意 |
| gif.js | Web Worker使用。ブラウザ上での生成は解像度が大きいと遅い（720px×30秒で数十秒） |
| Position フィールド | クォート付き `"lat,lon"` 複合フィールド。PapaParseはデフォルト対応済みだが分割処理が必要 |
| 大量データ | 数十万点をそのまま描画すると重い → 間引き（decimation）ロジックを検討 |
| CORS | RailwayバックエンドにVercelドメインを許可リスト登録必須 |
