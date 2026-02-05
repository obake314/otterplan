# Schedule Coordinator - 日程調整ツール

Firebase + reCAPTCHA によるセキュアな日程調整アプリ

---

## セットアップ手順

### 1. Firebase プロジェクト作成（無料）

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `schedule-app`）
4. Google Analytics はオフでOK
5. 「プロジェクトを作成」

### 2. Firestore データベース作成

1. Firebase Console の左メニュー「Firestore Database」
2. 「データベースを作成」
3. 「テストモードで開始」を選択（後でルールを設定）
4. リージョン: `asia-northeast1`（東京）を選択
5. 「有効にする」

### 3. Firebase 設定を取得

1. Firebase Console のプロジェクト設定（歯車アイコン）
2. 「全般」タブの下部「マイアプリ」
3. 「ウェブアプリを追加」（</>アイコン）
4. アプリ名を入力、「アプリを登録」
5. 表示される `firebaseConfig` をコピー

### 4. reCAPTCHA v3 設定（無料）

1. [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin) にアクセス
2. 「v3 Admin Console」→「+」で新規作成
3. 設定:
   - ラベル: `schedule-app`
   - reCAPTCHA タイプ: **reCAPTCHA v3**
   - ドメイン: `localhost` と本番ドメインを追加
4. 「送信」→ **サイトキー** をコピー

### 5. コードに設定を反映

**`src/firebase.js`** を編集:
```javascript
const firebaseConfig = {
  apiKey: "あなたのapiKey",
  authDomain: "あなたのプロジェクト.firebaseapp.com",
  projectId: "あなたのプロジェクト",
  storageBucket: "あなたのプロジェクト.appspot.com",
  messagingSenderId: "あなたのsenderId",
  appId: "あなたのappId"
};
```

**`src/main.jsx`** を編集:
```javascript
const RECAPTCHA_SITE_KEY = 'あなたのreCAPTCHAサイトキー'
```

### 6. Firestore セキュリティルール設定

1. Firebase Console →「Firestore Database」→「ルール」タブ
2. `firestore.rules` の内容をコピーペースト
3. 「公開」

---

## ローカル実行

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く

---

## デプロイ

### Netlify（推奨）

1. ビルド:
   ```bash
   npm run build
   ```

2. [Netlify](https://app.netlify.com) で「Add new site」→「Deploy manually」

3. `dist` フォルダをドラッグ&ドロップ

4. 完了！

**GitHub連携の場合:**
- Build command: `npm run build`
- Publish directory: `dist`

### GitHub Pages

1. `vite.config.js` を編集:
   ```javascript
   export default defineConfig({
     plugins: [react()],
     base: '/リポジトリ名/'
   })
   ```

2. GitHubにプッシュ

3. Settings → Pages → Source: 「GitHub Actions」

---

## 料金目安（Firebase無料枠）

| 項目 | 無料枠 | 超過時 |
|-----|-------|-------|
| Firestore読み取り | 5万/日 | $0.06/10万 |
| Firestore書き込み | 2万/日 | $0.18/10万 |
| ストレージ | 1GB | $0.18/GB |

**個人〜小規模利用なら無料枠で十分です**

---

## セキュリティ機能

- **reCAPTCHA v3**: イベント作成時にボット判定
- **Firestoreルール**: 不正なデータ書き込みを防止
- **自動削除**: 最終候補日の翌日にURL無効化

---

## 機能一覧

- イベント作成（日時候補10個まで）
- オフライン会場情報
- 参加者の回答収集（可能/不可/調整中）
- グループチャット
- 主催者→参加者へのDM
- 予定のFIX（確定）と共有
- 外部サービス連携（Google Calendar, Zoom, Teams, Mail, LINE）

---

## オプション: より強固なセキュリティ

本番環境では以下を推奨:

1. **Cloud Functions でサーバーサイド reCAPTCHA 検証**
2. **Firebase Authentication でユーザー認証**
3. **App Check でアプリ認証**

これらは追加コストなしで実装可能です。必要であれば対応します。
