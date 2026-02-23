# Broadcast Tracking System

ADS-B（航空機）/ AIS（船舶）の移動データを地図上でアニメーション表示し、GIF / ZIP エクスポートできる Web ツール。

## ローカル起動

### フロントエンド

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### バックエンド（GIF/ZIP エクスポートが必要な場合）

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 入力データ形式

ADS-B 例（実サンプル準拠）:
```csv
Timestamp,UTC,Callsign,Position,Altitude,Speed,Direction
1684515906,2023-05-19T17:05:06Z,CTM1022,"21.66923,39.136734",0,0,250
```

AIS（今後対応）:
```csv
Timestamp,UTC,MMSI,VesselName,Position,Speed,Course
```

## デプロイ

| サービス | 対象 | 設定 |
|---|---|---|
| Vercel | `frontend/` | フレームワーク: Next.js / 環境変数: `NEXT_PUBLIC_BACKEND_URL` |
| Railway | `backend/` | Dockerfile ビルド / ポート: 8000 |

## 機能

- CSV ドラッグ＆ドロップ読み込み（複数ファイル対応）
- 再生 / 停止 / シーク / 速度変更（×1〜×100）
- 軌跡表示（全表示 / 直近 N 分 / 非表示）
- アイコン種別・色・サイズ個別設定
- ベースマップ切替（OSM / CartoDB / ESRI 衛星 / 地理院）
- エクスポート: クライアント GIF / サーバ GIF / 連番 PNG ZIP
- エクスポート動画への日時描画（中央下部、ベースマップに応じて白/黒切替）

## 実機確認手順

### 1. 起動

1. フロントエンドを起動する。
```bash
cd frontend
npm install
npm run dev
```
2. サーバエクスポートも確認する場合はバックエンドを起動する。
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
3. ブラウザで `http://localhost:3000` を開く。

### 2. 基本動作確認

1. サンプル CSV を読み込む。
2. 地図上に軌跡とアイコンが表示されることを確認する。
3. タイムライン再生・停止・シーク・速度変更が動作することを確認する。

### 3. エクスポート確認（日時描画）

1. サイドバーのエクスポート設定で `日時を描画` を `ON` にする。
2. 日時形式を `データそのまま (UTC)` / `日本時間 (JST)` で切り替え、表示時刻と末尾ラベル（UTC/JST）が切り替わることを確認する。
3. `現在フレームをプレビュー` を押し、日時が画像の中央下部に表示されることを確認する。
4. ベースマップを切り替え、文字色が地図に応じて白/黒で切り替わることを確認する。
5. `日時を描画` を `OFF` にし、プレビューで日時が非表示になることを確認する。
6. `エクスポート開始` を実行し、出力 GIF/ZIP の各フレームでも表示状態が一致することを確認する。

### 4. 推奨確認パターン

1. `CartoDB Dark` または `ESRI 衛星` で白文字を確認する。
2. `OpenStreetMap` / `CartoDB Positron` / `地理院タイル（標準地図）` で黒文字を確認する。
