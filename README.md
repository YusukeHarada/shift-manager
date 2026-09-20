# シフト管理アプリ

介護士向けの月次シフト管理Webアプリです。紙で配布されるシフト表を見ながら手入力し、カレンダー形式で確認・管理できます。入力したシフトから勤務の偏りや疲労の蓄積を分析することもできます。

## 機能

- Supabase 認証によるログイン（メール／パスワード）
- 月次シフトの手動入力（ベースシフト7種類 ＋ αオプション複数選択）
- 複数の日をまとめて入力する一括入力モード
- カレンダー表示 / リスト表示 / 分析表示の切り替え
- 勤務の分析と疲労度の推移（下記）
- 次の出勤日の表示
- 月をまたいだナビゲーション（ボタン・左右スワイプ）
- 勤務時間表（各シフトの始業・終業の一覧）
- 表示設定（週の開始曜日・テーマ5種・ライト／ダーク／自動）
- Googleカレンダー向け iCal（.ics）エクスポート

## 分析タブ

入力済みのシフトから、その月の働き方を数値で振り返れます。

- **今の疲労度** — 今日の値と水準（ゆとり／注意／要休養）。先のシフトは入力済みなので、このあといつピークが来るかも予告します
- **疲労度の推移** — 日ごとの棒グラフ。棒は「前日までの持ち越し」と「その日の勤務で積んだぶん」に分かれ、タップするとその日の内訳が出ます
- **気をつけたい日** — 連勤と、勤務間インターバルが短い並びの警告
- **今月の勤務** — 稼働日数・休日数・総拘束時間（うち夜勤／うち当直）・1日平均・最大連勤・最短の空き
- **シフト種別の内訳** — 種別ごとの回数と割合
- **曜日別の傾向** — 曜日 × シフト種別のヒートマップ

右上の「見方」ボタンから、数字の意味・勤務ごとの重さ・読むときの注意をアプリ内で確認できます。

疲労度は「前日の疲労の一部が翌日に残る」という蓄積モデルで算出しています。計算方法と重み付けの根拠は [詳細設計書](docs/DESIGN.md) を参照してください。

> **疲労度はあくまで目安です。** シフトの並びから機械的に算出した値で、医学的な指標ではありません。体調の判断は自身の実感を優先してください。

## シフト区分

### ベースシフト（1日に1つ）

| キー | 意味 | 紙面の記号 |
|------|------|-----------|
| 日 | 日勤 | 日 |
| 早1 | 早番1 | 早1 |
| 早 | 早番 | 早 |
| 遅 | 遅番 | 遅 |
| 夜 | 夜勤 | 半月記号 |
| 明 | 明け休み | ●（黒丸） |
| 休 | 休み | × |

### αオプション（ベースシフトに追加可・複数選択可）

| キー | 意味 |
|------|------|
| 残 | 残業 |
| 会 | 会議 |
| 当 | 当直 |
| 前休 | AM休（午前休み・午後から勤務） |
| 後休 | PM休（午後休み・午前のみ勤務） |

> **当直はαオプションにしかありません。** 以前はベースシフトにも「当」がありましたが、同じ勤務がベースとαの2箇所から選べて紛らわしいため削除しました。αの「当」は、例えば日勤や明け休みの日に当直業務が加わる場合に使います。

> **「前休」と「後休」は同時に選べません**（片方を選ぶともう片方が外れます）。例えば「午前休みで午後から遅番」は `遅` ＋ `前休` で表します。

## 技術スタック

- React 18
- Vite 5
- Supabase（PostgreSQL ＋ 認証）
- CSS 変数によるデザインシステム（フレームワークなし）
- Vitest / @testing-library/react（テスト）
- ESLint / Prettier
- Vercel（ホスティング）

## プロジェクト構成

```
shift-manager/
├── public/               # favicon, apple-touch-icon
├── src/
│   ├── main.jsx          # エントリーポイント（認証状態管理）
│   ├── App.jsx           # メインコンポーネント（シフト表示・入力・分析）
│   ├── Login.jsx         # ログイン画面
│   ├── shifts.js         # シフト種別の定義（App.jsx と analysis.js が共有）
│   ├── analysis.js       # 集計と疲労度の算出（UI を持たない純粋関数）
│   ├── supabase.js       # DB接続・fetchShifts / saveShift
│   ├── ical.js           # iCal（.ics）エクスポート
│   ├── index.css         # CSS 変数によるデザインシステム
│   ├── __mocks__/        # Supabase・iCal のテスト用モック
│   └── test/
│       ├── setup.js
│       ├── App.test.jsx       # UI テスト
│       ├── analysis.test.js   # 集計・疲労度の単体テスト
│       ├── Login.test.jsx     # ログイン画面のテスト
│       ├── colors.test.js     # シフト色のコントラスト検証
│       └── ical.test.js       # iCal 単体テスト
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

# 静的解析・整形
npm run lint
npm run format
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

- [変更履歴](CHANGELOG.md) — バージョンごとの変更点
- [詳細設計書](docs/DESIGN.md) — 機能仕様・データ設計・コンポーネント構成・テスト仕様
- [C/Python 開発者向けガイド](docs/GUIDE_FOR_C_PYTHON_DEVELOPERS.md) — React/JavaScript の概念を他言語と対比しながら解説

## ロードマップ

- [x] 手動入力・カレンダー表示・集計
- [x] Supabase によるデータ永続化
- [x] iCal エクスポート（Googleカレンダー連携）
- [x] Supabase 認証（メール／パスワードログイン）
- [x] モダン UI リデザイン（CSS 変数・アニメーション・ボトムシート）
- [x] 勤務の分析と疲労度の推移
- [ ] 複数月にまたがる長期トレンド
- [ ] Google Calendar API による自動同期
- [ ] シフト表写真からのAI自動入力

## ライセンス

Private
