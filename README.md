# シフト管理アプリ

介護士向けの月次シフト管理Webアプリです。紙で配布されるシフト表を見ながら手入力し、カレンダー形式で確認・管理できます。

## 機能

- Supabase 認証によるログイン（メール／パスワード）
- 月次シフトの手動入力（ベースシフト8種類 ＋ αオプション複数選択）
- カレンダー表示 / リスト表示の切り替え
- シフト種別ごとの集計
- 次の出勤日の表示
- 月をまたいだナビゲーション
- Googleカレンダー向け iCal（.ics）エクスポート

## シフト区分

### ベースシフト

| キー | 意味 | 紙面の記号 |
|------|------|-----------|
| 日 | 日勤 | 日 |
| 早 | 早番 | 早 |
| 早1 | 早番1 | 早1 |
| 遅 | 遅番 | 遅 |
| 夜 | 夜勤 | 半月記号 |
| 明 | 明け休み | ●（黒丸） |
| 当 | 当直 | ○（白丸） |
| 休 | 休み | × |

### αオプション（ベースシフトに追加可・複数選択可）

| キー | 意味 |
|------|------|
| 残 | 残業 |
| 会 | 会議 |
| 当 | 当直 |

## 技術スタック

- React 18
- Vite 5
- Supabase（PostgreSQL ＋ 認証）
- CSS 変数によるデザインシステム（フレームワークなし）
- Vitest / @testing-library/react（テスト）
- Vercel（ホスティング）

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm test

# ビルド
npm run build
```

## 環境変数

プロジェクトルートに `.env.local` を作成してください（Gitには含まれません）。

```
VITE_SUPABASE_URL=https://ygiaiwarujawjacrbseg.supabase.co
VITE_SUPABASE_KEY=sb_publishable_...
```

Vercelにデプロイする場合は、管理画面の `Settings` → `Environment Variables` に同じキーを設定してください。

## デプロイ

Vercel に GitHub リポジトリを連携してデプロイします。

1. https://vercel.com にアクセスしてGitHubでログイン
2. 「Add New Project」で本リポジトリを選択
3. 設定はデフォルトのまま「Deploy」
4. 環境変数を設定して「Redeploy」

## ロードマップ

- [x] 手動入力・カレンダー表示・集計
- [x] Supabase によるデータ永続化
- [x] iCal エクスポート（Googleカレンダー連携）
- [x] Supabase 認証（メール／パスワードログイン）
- [x] モダン UI リデザイン（CSS 変数・アニメーション・ボトムシート）
- [ ] Google Calendar API による自動同期
- [ ] シフト表写真からのAI自動入力

## ライセンス

Private
