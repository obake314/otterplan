# Otterplan - 日程調整ツール

かんたん日程調整ツール。候補日を作成してリンクを共有するだけで、みんなの予定を調整できます。

**デモ:** https://otterplan.netlify.app/

## 機能

- イベント作成（候補日時を複数設定）
- 招待URLを共有して回答を収集（○△×）
- 日程確定（FIX）
- 会場検索・設定（Google Maps連携）
- イベントチャット・ダイレクトメッセージ
- 主催者認証（organizer token）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 18 + Vite |
| バックエンド | Netlify Functions（サーバーレス） |
| データベース | NeonDB（PostgreSQL） |
| ホスティング | Netlify |

## セットアップ

### 1. NeonDB の準備

1. [Neon Console](https://console.neon.tech/) でプロジェクトを作成
2. 接続文字列をコピー（Dashboard → Connection Details）
3. SQL Editor で `schema.sql` の内容を実行してテーブルを作成

### 2. Google Maps API（任意）

会場検索機能を使う場合のみ必要。未設定でもモックデータで動作します。

1. [Google Cloud Console](https://console.cloud.google.com/) で「Places API (New)」を有効化
2. APIキーを作成してコピー

### 3. 環境変数

| 変数名 | 必須 | 用途 |
|--------|------|------|
| `DATABASE_URL` | Yes | NeonDB 接続文字列 |
| `GOOGLE_MAPS_API_KEY` | No | Google Places API キー |

### 4. ローカル開発

```bash
# 依存インストール
npm install

# .env を作成
echo "DATABASE_URL=your_neon_connection_string" > .env
echo "GOOGLE_MAPS_API_KEY=your_api_key" >> .env

# ローカル起動（Netlify Functions 含む）
npx netlify dev
```

### 5. Netlify へデプロイ

1. [Netlify](https://app.netlify.com/) で「Add new site」→「Import an existing project」
2. GitHub リポジトリを選択
3. ビルド設定（自動入力される）
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 環境変数を設定（Site configuration → Environment variables）
5. デプロイ実行

## プロジェクト構成

```
otterplan/
├── src/
│   ├── main.jsx                  # エントリーポイント
│   └── App.jsx                   # フロントエンド全体（SPA）
├── netlify/functions/
│   ├── events.js                 # イベント CRUD
│   ├── responses.js              # 回答の送信
│   ├── chat.js                   # イベントチャット
│   ├── dms.js                    # ダイレクトメッセージ
│   └── venues.js                 # 会場検索（Google Places）
├── public/
│   └── image.jpg                 # OGP画像
├── schema.sql                    # DB スキーマ定義
├── index.html                    # HTML エントリーポイント（OGPタグ含む）
├── netlify.toml                  # Netlify 設定
├── vite.config.js                # Vite 設定
└── package.json
```

## API エンドポイント

| メソッド | パス | 機能 |
|---------|------|------|
| GET | `/api/events?id={id}` | イベント取得（回答含む） |
| POST | `/api/events` | イベント作成 |
| PATCH | `/api/events` | 日程確定・会場設定 |
| POST | `/api/responses` | 回答送信 |
| GET | `/api/chat?event_id={id}` | チャット取得 |
| POST | `/api/chat` | チャット送信 |
| GET | `/api/dms?event_id={id}` | DM取得 |
| POST | `/api/dms` | DM送信 |
| POST | `/api/venues` | 会場検索 |

## データベーススキーマ

- **events** - イベント情報（候補日、確定日、会場、主催者トークン）
- **responses** - 回答データ（○△× の回答マップ）
- **chat_messages** - イベントチャットメッセージ
- **direct_messages** - ダイレクトメッセージ

詳細は `schema.sql` を参照。

## 料金目安（全て無料枠で運用可能）

| サービス | 無料枠 |
|---------|--------|
| Netlify | 100GB 帯域/月、125k Functions 実行/月 |
| NeonDB | 0.5GB storage、無制限 compute |
| Google Maps | $200/月 のクレジット |

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| "Event not found" エラー | NeonDB でテーブルが作成されているか確認 |
| 会場検索で結果が出ない | `GOOGLE_MAPS_API_KEY` が設定されているか確認（未設定時はモックデータ表示） |
| デプロイ後に動かない | Netlify で「Clear cache and deploy site」を実行 |
