# シフト管理アプリ 設計書

## 1. 概要

### 目的

介護士が紙で配布される月次勤務表を、スマートフォンで手軽に管理・確認できるようにするWebアプリケーション。

### 対象ユーザー

個人用途（ユーザ名はアプリ内で設定）

### 動作環境

- デプロイ先: Vercel（無料プラン）
- 対象ブラウザ: iOS Safari / Android Chrome
- データ永続化: Supabase（PostgreSQL）

---

## 2. 機能仕様

### 2.1 実装済み機能

#### シフト入力

日付をタップするとシフト選択ポップアップが表示される。ベースシフトを1つ選び、αオプションを複数選択して保存する2段構成。

**ベースシフト（8種類）**

| キー | 表示名 | 紙面の記号 | 開始 | 終了 |
|------|--------|-----------|------|------|
| 日 | 日勤 | 日 | 8:45 | 17:30 |
| 早1 | 早番1 | 早1 | 7:00 | 15:45 |
| 早 | 早番 | 早 | 7:30 | 16:15 |
| 遅 | 遅番 | 遅 | 10:15 | 19:00 |
| 夜 | 夜勤 | 半月記号 | 16:30 | 翌9:30 |
| 明 | 明け休み | ●（黒丸） | - | - |
| 当 | 当直 | ○（白丸） | 未定 | 未定 |
| 休 | 休み | × | - | - |

`start` / `end` フィールドを持つシフトのみ、勤務時間表モーダルに表示される。

**αオプション（複数選択可）**

| キー | 表示名 |
|------|--------|
| 残 | 残業 |
| 会 | 会議 |
| 当 | 当直 |

#### カレンダー表示

- 月単位のグリッド形式で表示
- 各セルにベースシフトのバッジを表示
- αオプションがある場合は小さく併記
- 今日の日付を青枠でハイライト
- 日曜は赤、土曜は青で曜日を色分け

#### リスト表示

- 1日〜月末を縦に並べたリスト形式
- 各行に日付・曜日・シフトバッジ・シフト名・αオプションを表示
- 今日の日付をハイライト

#### 月ナビゲーション

- ‹ / › ボタンで前後の月に移動
- 年をまたいだ移動に対応

#### 集計表示

- 当月のシフト種別ごとの件数を集計カードで表示
- 入力済みのシフト種別のみ表示（0件は非表示）

#### 次の出勤日表示

- 当月・今日以降で最初の「休み以外」のシフトを表示
- 他の月を表示中は非表示

#### 勤務時間表モーダル

- ヘッダーの「勤務時間表」ボタンをタップして開く
- `start` / `end` フィールドを持つシフト区分のみ一覧表示
- 夜勤の終了は翌日をまたぐため「翌9:30」と表記
- 当直は時間未定のためモーダルに表示しない
- オーバーレイまたは「閉じる」ボタンで閉じる

#### iCal エクスポート

- 当月のシフトデータを `.ics` 形式でダウンロード
- Googleカレンダーへのインポートに対応
- ベースシフトとαオプションを別イベントとして出力

### 2.2 実装予定機能

| 機能 | 状態 |
|------|------|
| Google Calendar API による自動同期 | 未着手 |
| シフト表写真からのAI自動入力 | 未着手 |

---

## 3. システム構成

```
ブラウザ（iOS Safari / Android Chrome）
  └─ React アプリ（Vercel）
       ├─ Supabase（PostgreSQL）← データ永続化
       └─ iCal出力 → Googleカレンダー
```

---

## 4. データ設計

### Supabase テーブル定義

```sql
create table shifts (
  id uuid default gen_random_uuid() primary key,
  year integer not null,
  month integer not null,
  day integer not null,
  shift_key text not null default '',
  alpha text[] default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(year, month, day)
);
```

### アプリ内のデータ形式

```javascript
// fetchShifts の戻り値
{
  "1":  { base: "早", alpha: ["残"] },
  "2":  { base: "夜", alpha: [] },
  "3":  { base: "休", alpha: ["会"] },
  ...
}
```

### 環境変数

| 変数名 | 説明 |
|--------|------|
| `VITE_SUPABASE_URL` | SupabaseプロジェクトURL |
| `VITE_SUPABASE_KEY` | Publishable key（anon key） |

---

## 5. コンポーネント構成

```
App
├── ヘッダー（ユーザ名・月ナビ・勤務時間表ボタン・カレンダー出力ボタン）
├── エラー表示
├── ローディング表示
├── 次の出勤カード
├── SummaryCards（集計）
├── ビュー切替ボタン
├── CalendarView または ListView
├── WorkTimeModal（勤務時間表モーダル）
└── ShiftPicker（シフト選択ポップアップ）
     ├── ベースシフト選択
     ├── αオプション選択（複数可）
     └── 保存ボタン
```

| コンポーネント | 役割 |
|----------------|------|
| App | 状態管理・Supabase読み書き・月ナビ制御 |
| CalendarView | 月カレンダーのグリッド表示 |
| ListView | 日付リスト表示 |
| ShiftPicker | シフト選択ポップアップ（ベース＋α） |
| ShiftBadge | シフト種別の色付きバッジ |
| AlphaBadge | αオプションの色付きバッジ |
| SummaryCards | 種別ごとの件数カード |
| WorkTimeModal | 勤務時間表のモーダルダイアログ |

---

## 6. 状態管理

| state | 型 | 初期値 | 説明 |
|-------|----|--------|------|
| year | number | 現在年 | 表示中の年 |
| month | number | 現在月 | 表示中の月 |
| shifts | object | {} | 当月のシフトデータ |
| view | string | "calendar" | 表示モード（calendar / list） |
| picker | number \| null | null | 選択中の日付（null=非表示） |
| loading | boolean | false | データ読み込み中フラグ |
| saving | boolean | false | データ保存中フラグ |
| error | string \| null | null | エラーメッセージ |
| showWorkTable | boolean | false | 勤務時間表モーダルの表示フラグ |

---

## 7. データフロー

```
日付タップ
  └─ picker に日付をセット → ShiftPicker 表示
       └─ ベースシフト選択 → αオプション選択 → 保存ボタン
            ├─ shifts を即時更新（楽観的更新）
            ├─ Supabase に upsert
            └─ picker を null → ShiftPicker 非表示

月ナビタップ
  └─ year / month を更新
       └─ useEffect が発火
            └─ Supabase から該当月を取得 → shifts を更新

勤務時間表ボタン
  └─ showWorkTable を true → WorkTimeModal 表示
       └─ 閉じるボタン or オーバーレイクリック
            └─ showWorkTable を false → WorkTimeModal 非表示

カレンダー出力ボタン
  └─ exportToICal(year, month, shifts)
       └─ .ics ファイルをダウンロード
```

---

## 8. ファイル構成

```
shift-manager/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .gitignore                        # .env.local・node_modules・dist を除外
├── .env.local                        # 環境変数（Git管理外）
├── README.md
├── docs/
│   ├── DESIGN.md
│   └── GUIDE_FOR_C_PYTHON_DEVELOPERS.md
└── src/
    ├── main.jsx                      # エントリーポイント
    ├── App.jsx                       # メインコンポーネント
    ├── supabase.js                   # Supabaseクライアント・DB操作
    ├── ical.js                       # iCalエクスポート
    ├── __mocks__/
    │   ├── supabase.js               # テスト用Supabaseモック
    │   └── ical.js                   # テスト用iCalモック
    └── test/
        ├── setup.js                  # テスト共通セットアップ
        ├── App.test.jsx              # UIコンポーネントのテスト
        └── ical.test.js             # iCalエクスポートのユニットテスト
```

---

## 9. テスト仕様

### 実施環境

- テストフレームワーク: Vitest
- レンダリング: @testing-library/react
- DOM環境: jsdom
- モック方式: `src/__mocks__/` ディレクトリによるモジュールモック

### モック戦略

Supabase と iCal は外部依存のため、テスト時は `__mocks__` ディレクトリのモックに差し替える。これにより実際のDB接続・ファイルダウンロードを行わずにUIの動作を検証できる。

```
vi.mock("../supabase", () => supabaseMock);  // DB接続をモック化
vi.mock("../ical", () => icalMock);          // ファイルダウンロードをモック化
```

### テストケース一覧

**App.test.jsx（UIコンポーネントのテスト）**

| # | テストスイート | テスト内容 | 結果 |
|---|---------------|-----------|------|
| 1 | getDaysInMonth | 2025年11月は30日 | ✅ |
| 2 | getDaysInMonth | 2024年2月は29日（うるう年） | ✅ |
| 3 | getDaysInMonth | 2025年2月は28日 | ✅ |
| 4 | getDaysInMonth | 1月は31日 | ✅ |
| 5 | getFirstDayOfWeek | 2025年11月1日は土曜日 | ✅ |
| 6 | getFirstDayOfWeek | 2026年1月1日は木曜日 | ✅ |
| 7 | App | ヘッダーに「ユーザ」が表示される | ✅ |
| 8 | App | 「シフト管理」ラベルが表示される | ✅ |
| 9 | App | カレンダー/リスト切替ボタンが存在する | ✅ |
| 10 | App | 月ナビの‹›ボタンが存在する | ✅ |
| 11 | App | ›ボタンで翌月に進める | ✅ |
| 12 | App | ‹ボタンで前月に戻れる | ✅ |
| 13 | App | リストビューに切り替えられる | ✅ |
| 14 | App | 日付タップでシフト選択ポップアップが開く | ✅ |
| 15 | App | ポップアップにベースシフト種別が表示される | ✅ |
| 16 | App | ポップアップにαオプションが表示される | ✅ |
| 17 | App | ポップアップに保存ボタンが存在する | ✅ |
| 18 | App | 保存ボタンをクリックするとポップアップが閉じる | ✅ |
| 19 | App | 保存後にSupabaseのsaveShiftが呼ばれる | ✅ |
| 20 | App | αオプションを複数選択できる | ✅ |
| 21 | App | シフト選択後に集計カードが表示される | ✅ |
| 22 | App | ポップアップ外クリックで閉じる | ✅ |
| 23 | App | カレンダー出力ボタンが存在する | ✅ |
| 24 | App | カレンダー出力ボタンでexportToICalが呼ばれる | ✅ |
| 25 | App | Supabaseデータがある場合シフトが表示される | ✅ |
| 26 | WorkTimeModal | 「勤務時間表」ボタンが存在する | ✅ |
| 27 | WorkTimeModal | ボタンをクリックするとモーダルが開く | ✅ |
| 28 | WorkTimeModal | モーダルに各シフト区分が表示される | ✅ |
| 29 | WorkTimeModal | モーダルに勤務時間が表示される | ✅ |
| 30 | WorkTimeModal | 「閉じる」ボタンでモーダルが閉じる | ✅ |
| 31 | WorkTimeModal | オーバーレイをクリックするとモーダルが閉じる | ✅ |
| 32 | WorkTimeModal | 時間情報のないシフトは表に含まれない | ✅ |

**ical.test.js（iCalエクスポートのユニットテスト）**

| # | テストスイート | テスト内容 | 結果 |
|---|---------------|-----------|------|
| 33 | exportToICal | αなし → ベースシフト単体イベントが1つ出力される | ✅ |
| 34 | exportToICal | αあり → ベース単体イベントは出力されずα付きのみ出力される | ✅ |
| 35 | exportToICal | αが複数 → α付きイベントがα数分出力される | ✅ |
| 36 | exportToICal | 複数日のデータを正しく出力できる | ✅ |
| 37 | exportToICal | baseが空の日はイベントに含まれない | ✅ |
| 38 | exportToICal | 日付フォーマットが正しい（YYYYMMDD形式） | ✅ |
| 39 | exportToICal | ファイル名に年月が含まれる | ✅ |

合計: 39件

---

## 10. ロードマップ

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1 | 手動入力・カレンダー表示・集計 | ✅ 完了 |
| Phase 2 | Supabase によるデータ永続化 | ✅ 完了 |
| Phase 3 | iCal エクスポート（Googleカレンダー連携） | ✅ 完了 |
| Phase 4 | 勤務時間表モーダル | ✅ 完了 |
| Phase 5 | Google Calendar API による自動同期 | 🔲 未着手 |
| Phase 6 | シフト表写真からのAI自動入力 | 🔲 未着手 |
