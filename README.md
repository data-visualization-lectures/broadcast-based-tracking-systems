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
