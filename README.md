# Schedule - 日程調整ツール

Netlify + NeonDB + Google Maps API のシンプル構成

## セットアップ（10分）

### 1. NeonDB 作成

1. [Neon Console](https://console.neon.tech/) にアクセス
2. 「New Project」をクリック
3. プロジェクト名を入力（例：schedule-app）
4. 「Create Project」

5. **接続文字列をコピー**
   - Dashboard → Connection Details
   - 「Connection string」をコピー（`postgresql://...` で始まる）

6. **テーブル作成**
   - 左メニュー「SQL Editor」
   - `schema.sql` の内容をコピペして実行

### 2. Google Maps API（任意）

会場検索機能を使う場合のみ必要。なくても動作します（モックデータ表示）。

1. [Google Cloud Console](https://console.cloud.google.com/)
2. 「APIとサービス」→「ライブラリ」
3. 「Places API (New)」を有効化
4. 「認証情報」→「APIキーを作成」
5. キーをコピー

### 3. GitHub リポジトリ作成

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_NAME/schedule-app.git
git push -u origin main
```

### 4. Netlify デプロイ

1. [Netlify](https://app.netlify.com/) にログイン
2. 「Add new site」→「Import an existing project」
3. GitHub を選択、リポジトリを選択

4. **ビルド設定**（自動で入るはず）
   - Build command: `npm run build`
   - Publish directory: `dist`

5. **環境変数を設定**（重要！）
   - 「Site configuration」→「Environment variables」→「Add a variable」
   
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | NeonDBの接続文字列 |
   | `GOOGLE_MAPS_API_KEY` | Google Maps APIキー（任意） |

6. 「Deploy site」

### 5. 完了！

デプロイ完了後、表示されるURLでアクセス可能。

---

## ローカル開発

```bash
# 依存インストール
npm install

# .env.local を作成
echo "DATABASE_URL=your_neon_connection_string" > .env.local
echo "GOOGLE_MAPS_API_KEY=your_api_key" >> .env.local

# Netlify CLI インストール
npm install -g netlify-cli

# ローカル起動（Functions含む）
netlify dev
```

---

## 構成

```
schedule-neon/
├── src/
│   ├── main.jsx
│   └── App.jsx          # フロントエンド
├── netlify/functions/
│   ├── events.js        # イベントCRUD
│   ├── responses.js     # 回答追加
│   └── venues.js        # 会場検索
├── schema.sql           # DBスキーマ
├── netlify.toml         # Netlify設定
└── package.json
```

---

## 料金（全て無料枠で十分）

| サービス | 無料枠 |
|---------|--------|
| Netlify | 100GB帯域/月、125k Functions実行/月 |
| NeonDB | 0.5GB storage、無制限compute |
| Google Maps | $200/月のクレジット |

---

## 機能

- ✅ イベント作成（候補日時10個まで）
- ✅ 招待URL共有
- ✅ 回答収集（○△×）
- ✅ 日程確定（FIX）
- ✅ 会場検索・設定（Google Maps連携）

---

## トラブルシューティング

### "Event not found" エラー
→ NeonDBのテーブルが作成されているか確認

### 会場検索で結果が出ない
→ GOOGLE_MAPS_API_KEY が設定されているか確認
→ APIキーなしでもモックデータが表示される

### デプロイ後に動かない
→ Netlifyの「Deploys」→「Trigger deploy」→「Clear cache and deploy site」
