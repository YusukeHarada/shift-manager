# シフト管理アプリ 設計書

## 1. 概要

### 目的

介護士（原田 真依）が紙で配布される月次勤務表を、スマートフォンで手軽に管理・確認できるようにするWebアプリケーション。

### 対象ユーザー

原田 真依（個人用途）

### 動作環境

- デプロイ先: Vercel（無料プラン）
- 対象ブラウザ: iOS Safari / Android Chrome
- データ永続化: **現在 localStorage → 今後 Supabase（PostgreSQL）に移行予定**

---

## 2. 機能仕様

### 2.1 実装済み機能

#### シフト入力

日付をタップするとシフト選択ポップアップが表示される。選択可能なシフト種別は以下の9種類（＋未入力）。

| キー | 表示名 | 説明 | 紙面での記号 |
|------|--------|------|------------|
| 早 | 早番 | 早番シフト | 早 |
| 早1 | 早番1 | 早番（別種別） | 早1 |
| 遅 | 遅番 | 遅番シフト | 遅 |
| 夜 | 夜勤 | 夜勤シフト | 半月記号 |
| 明 | 明け休み | 夜勤明け休日 | 黒丸（●） |
| 当 | 当直 | 当直シフト | 白丸（○） |
| 休 | 休み | 公休・有給 | × |
| α | 残業 | 残業あり | α |
| 会 | 会議 | 会議出席日 | 会 |
| （空） | 未入力 | 未登録 | - |

#### カレンダー表示

- 月単位のカレンダーをグリッド形式で表示
- 各セルにシフト種別バッジを表示
- 今日の日付を青枠でハイライト
- 日曜は赤、土曜は青で曜日を色分け

#### リスト表示

- 1日〜月末を縦に並べたリスト形式
- 各行に日付・曜日・シフトバッジ・シフト名を表示
- 今日の日付をハイライト

#### 月ナビゲーション

- ‹ / › ボタンで前後の月に移動
- 年をまたいだ移動に対応（12月→1月、1月→12月）

#### 集計表示

- 当月のシフト種別ごとの件数を集計カードで表示
- 入力済みのシフト種別のみ表示（0件は非表示）

#### 次の出勤日表示

- 当月・今日以降で最初の「休み以外」のシフトを表示
- 他の月を表示中は非表示

### 2.2 実装予定機能

#### Supabase によるデータ永続化

- 現在の localStorage をSupabase（PostgreSQL）に置き換え
- 端末をまたいでデータを共有できるようにする

#### Google カレンダー連携

- 月のシフトデータを iCal（.ics）形式でエクスポート
- Google カレンダーへのインポートに対応
- 将来的には Google Calendar API による自動同期も検討

---

## 3. システム構成

### 現在の構成

```
ブラウザ（iOS Safari / Android Chrome）
  └─ React アプリ（Vercel）
       └─ localStorage（データ保存）
```

### 移行後の構成（Supabase 導入後）

```
ブラウザ（iOS Safari / Android Chrome）
  └─ React アプリ（Vercel）
       └─ Supabase（PostgreSQL）
            └─ shifts テーブル
```

---

## 4. データ設計

### 現在: localStorage

- キー形式: `shifts_{year}_{month}`（例: `shifts_2025_11`）
- 値形式: `{ "1": "早", "2": "夜", ... }` のJSON
- 月ごとに独立して保存・読み込み

### 移行後: Supabase テーブル定義

```sql
create table shifts (
  id uuid default gen_random_uuid() primary key,
  year integer not null,
  month integer not null,
  day integer not null,
  shift_key text not null default '',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(year, month, day)
);
```

---

## 5. コンポーネント構成

```
App
├── ヘッダー（氏名・月ナビ）
├── 次の出勤カード
├── SummaryCards（集計）
├── ビュー切替ボタン
├── CalendarView または ListView
└── ShiftPicker（ポップアップ）
```

| コンポーネント | 役割 |
|----------------|------|
| App | 状態管理・データ読み書き・月ナビ制御 |
| CalendarView | 月カレンダーのグリッド表示 |
| ListView | 日付リスト表示 |
| ShiftPicker | シフト選択ポップアップ |
| ShiftBadge | シフト種別の色付きバッジ |
| SummaryCards | 種別ごとの件数カード |

---

## 6. 状態管理

App コンポーネントが以下の状態を管理する。

| state | 型 | 初期値 | 説明 |
|-------|----|--------|------|
| year | number | 現在年 | 表示中の年 |
| month | number | 現在月 | 表示中の月 |
| shifts | object | {} | 当月のシフトデータ |
| view | string | "calendar" | 表示モード（calendar / list） |
| picker | number \| null | null | 選択中の日付（null=非表示） |

---

## 7. データフロー

```
日付タップ
  └─ picker に日付をセット → ShiftPicker 表示
       └─ シフト選択
            ├─ shifts を更新（state）
            ├─ データ層に保存（現在: localStorage / 移行後: Supabase）
            └─ picker を null → ShiftPicker 非表示

月ナビタップ
  └─ year / month を更新
       └─ useEffect が発火
            └─ データ層から該当月を読み込み → shifts を更新
```

---

## 8. ファイル構成

```
shift-manager/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── README.md
├── DESIGN.md
└── src/
    ├── main.jsx              # エントリーポイント
    ├── App.jsx               # メインコンポーネント
    └── test/
        ├── setup.js          # テスト共通セットアップ
        └── App.test.jsx      # テストコード
```

---

## 9. テスト仕様

### 実施環境

- テストフレームワーク: Vitest
- レンダリング: @testing-library/react
- DOM環境: jsdom

### テストケース一覧

| # | テストスイート | テスト内容 | 結果 |
|---|---------------|-----------|------|
| 1 | getDaysInMonth | 2025年11月は30日 | ✅ |
| 2 | getDaysInMonth | 2024年2月は29日（うるう年） | ✅ |
| 3 | getDaysInMonth | 2025年2月は28日 | ✅ |
| 4 | getDaysInMonth | 1月は31日 | ✅ |
| 5 | getFirstDayOfWeek | 2025年11月1日は土曜日 | ✅ |
| 6 | getFirstDayOfWeek | 2026年1月1日は木曜日 | ✅ |
| 7 | localStorage | シフトデータを保存して読み込める | ✅ |
| 8 | localStorage | 存在しないキーはnullを返す | ✅ |
| 9 | localStorage | 月をまたいでデータが独立している | ✅ |
| 10 | App | ヘッダーに「原田 真依」が表示される | ✅ |
| 11 | App | 「シフト管理」ラベルが表示される | ✅ |
| 12 | App | カレンダー/リスト切替ボタンが存在する | ✅ |
| 13 | App | 月ナビの‹›ボタンが存在する | ✅ |
| 14 | App | ›ボタンで翌月に進める | ✅ |
| 15 | App | ‹ボタンで前月に戻れる | ✅ |
| 16 | App | リストビューに切り替えられる | ✅ |
| 17 | App | 日付タップでシフト選択ポップアップが開く | ✅ |
| 18 | App | ポップアップに全シフト種別が表示される | ✅ |
| 19 | App | シフト選択するとポップアップが閉じる | ✅ |
| 20 | App | シフト選択後に集計カードが表示される | ✅ |
| 21 | App | シフト選択後にlocalStorageに保存される | ✅ |
| 22 | App | ポップアップ外クリックで閉じる | ✅ |

合計: 22件 / 22件 パス

---

## 10. 今後のロードマップ

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1 | 手動入力・カレンダー表示・集計 | ✅ 完了 |
| Phase 2 | Supabase によるデータ永続化 | 🔲 未着手 |
| Phase 3 | Google カレンダー連携（iCalエクスポート） | 🔲 未着手 |
| Phase 4 | シフト表写真からのAI自動入力 | 🔲 未着手 |
