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
| 当 | 当直（他シフトへの追加） |
| 前休 | AM休（午前休み・午後から勤務） |
| 後休 | PM休（午後休み・午前のみ勤務） |

> **注意**: αオプションの「当」はベースシフト「当」とキーが同じですが、別の概念です。αオプションとしての「当」は、例えば日勤日に当直業務が加わる場合などに使います。

> **注意**: 「前休」と「後休」は同時に選べません（片方を選ぶともう片方が外れます）。例えば「午前休みで午後から遅番」は `遅` ＋ `前休` で表します。

## 技術スタック

- React 18
- Vite 5
- Supabase（PostgreSQL ＋ 認証）
- CSS 変数によるデザインシステム（フレームワークなし）
- Vitest / @testing-library/react（テスト）
- Vercel（ホスティング）

## プロジェクト構成

```
shift-manager/
├── public/               # favicon, apple-touch-icon
├── src/
│   ├── main.jsx          # エントリーポイント（認証状態管理）
│   ├── App.jsx           # メインコンポーネント（シフト表示・入力）
│   ├── Login.jsx         # ログイン画面
│   ├── supabase.js       # DB接続・fetchShifts / saveShift
│   ├── ical.js           # iCal（.ics）エクスポート
│   ├── index.css         # CSS 変数によるデザインシステム
│   ├── __mocks__/        # Supabase・iCal のテスト用モック
│   └── test/
│       ├── setup.js
│       ├── App.test.jsx  # UI テスト（25件）
│       └── ical.test.js  # iCal 単体テスト（7件）
├── docs/
│   ├── DESIGN.md                        # 詳細設計書
│   └── GUIDE_FOR_C_PYTHON_DEVELOPERS.md # C/Python 開発者向け解説
└── index.html
```

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm test

# テスト（ウォッチモード）
npm run test:watch

# ビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

## 環境変数

プロジェクトルートに `.env.local` を作成してください（Git には含まれません）。

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_KEY=<your-anon-key>

# 任意: アプリ内に表示するユーザ名（未設定時は "ユーザ" と表示）
VITE_USER_NAME=山田 太郎
```

Vercel にデプロイする場合は、管理画面の `Settings` → `Environment Variables` に同じキーを設定してください。

## Supabase セットアップ

[Supabase](https://supabase.com) でプロジェクトを作成後、SQL エディタで以下を実行してテーブルを作成します。

```sql
create table shifts (
  id         uuid default gen_random_uuid() primary key,
  year       integer not null,
  month      integer not null,
  day        integer not null,
  shift_key  text not null default '',
  alpha      text[] default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(year, month, day)
);
```

## デプロイ

Vercel に GitHub リポジトリを連携してデプロイします。

1. https://vercel.com にアクセスしてGitHubでログイン
2. 「Add New Project」で本リポジトリを選択
3. 設定はデフォルトのまま「Deploy」
4. 環境変数を設定して「Redeploy」

## ドキュメント

- [詳細設計書](docs/DESIGN.md) — 機能仕様・データ設計・コンポーネント構成・テスト仕様
- [C/Python 開発者向けガイド](docs/GUIDE_FOR_C_PYTHON_DEVELOPERS.md) — React/JavaScript の概念を他言語と対比しながら解説

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
