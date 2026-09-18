# CLAUDE.md

## プロジェクト概要

介護士向け月次シフト管理 Web アプリ。紙のシフト表を手入力し、カレンダー／リスト形式で確認できる。React 18 + Vite 5 + Supabase（PostgreSQL）構成。

## コマンド

```bash
npm run dev          # 開発サーバー起動（http://localhost:5173）
npm test             # テスト一括実行（CI 向け）
npm run test:watch   # テスト監視モード（開発中）
npm run build        # 本番ビルド（dist/）
npm run preview      # ビルド結果の確認
```

## ファイル構成と役割

```
src/
├── main.jsx        # Supabase セッション監視。未ログイン→Login、ログイン済み→App
├── App.jsx         # 全機能のメインコンポーネント（状態管理・表示・入力）
├── Login.jsx       # メール／パスワードログイン画面
├── supabase.js     # fetchShifts / saveShift の2関数のみ公開
├── ical.js         # exportToICal：.ics ファイル生成・ダウンロード
├── index.css       # CSS 変数によるデザインシステム（フレームワークなし）
├── __mocks__/      # vitest 用モック（supabase.js / ical.js）
└── test/
    ├── setup.js         # @testing-library/jest-dom のセットアップ
    ├── App.test.jsx     # UI テスト 47 件
    ├── Login.test.jsx   # ログイン画面 7 件
    ├── colors.test.js   # シフト色のコントラスト検証 31 件
    └── ical.test.js     # iCal 単体テスト 18 件
```

## アーキテクチャ

コンポーネントはすべて `App.jsx` に同居している（ファイル分割なし）。

```
main.jsx（認証ゲート）
└── App（状態管理）
    ├── CalendarView   月グリッド
    ├── ListView       日付リスト
    ├── ShiftPicker    入力ポップアップ（ベース選択 → α選択 → 保存）
    ├── ShiftBadge     シフト色付きバッジ
    ├── AlphaBadge     αオプション色付きバッジ
    └── SummaryCards   種別ごとの集計カード
```

データフローは楽観的更新：保存ボタン押下で `shifts` state を即時更新し、バックグラウンドで Supabase に upsert する。

## iCal エクスポート（ical.js）

Google カレンダーへの再インポートで予定が重複しないよう、以下を守ること。

- **UID は日付だけで決まる**（`shift-YYYYMMDD@shift-manager`）。シフト内容を UID に含めると、内容を変えたときに旧予定が残って重複する
- **1日1イベント**。αオプションは `早番（残業・会議）` のように SUMMARY にまとめる
- **月内の全日を出力する**。シフト未入力の日は `STATUS:CANCELLED` にして、以前登録された予定を消す
- `SEQUENCE` は書き出しごとに増える値（分単位のタイムスタンプ）。古い更新として無視されないようにするため

## データモデル

### Supabase `shifts` テーブル

```sql
id uuid PK, year int, month int, day int,
shift_key text, alpha text[], created_at, updated_at
UNIQUE(year, month, day)
```

### アプリ内 `shifts` オブジェクト（`fetchShifts` の戻り値）

```js
{
  "1": { base: "早", alpha: ["残", "会"] },
  "15": { base: "休", alpha: [] },
  // キーは日付の文字列（"1"〜"31"）
}
```

## シフト定数（App.jsx）

`BASE_SHIFTS` と `ALPHA_TYPES` はそれぞれ `{ key, label, color, bg }` の配列。変更時は `ical.js` の `BASE_LABELS` / `ALPHA_LABELS` も合わせて更新すること。

**αオプション「当」とベースシフト「当」はキーが同じだが別の概念。** αの「当」は他シフトへの追加当直を意味する。

αオプションに `group` を持たせると同一グループ内で排他選択になる（`toggleAlphaKey()`）。半休の「前休」「後休」が `group: "half"` を使っている。

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `VITE_SUPABASE_URL` | ○ | `https://<project>.supabase.co` |
| `VITE_SUPABASE_KEY` | ○ | anon/publishable key |
| `VITE_USER_NAME` | — | アプリ表示名（未設定時は `"ユーザ"`） |

`.env.local` に記述（Git 管理外）。

## テスト方針

- Supabase と iCal は `__mocks__/` のモックで置き換え（`vi.mock`）
- `App.test.jsx` では `session` prop を渡して `<App session={mockSession} />` でレンダリング
- `saveShift` の呼び出し引数の検証でデータ保存ロジックを確認している
- 新機能追加時は `App.test.jsx` にシナリオを追加する

## デザインシステム（index.css）

トークンは `:root` の CSS 変数。値を直接書かず変数を使うこと。

| 種類 | トークン |
|------|----------|
| 文字サイズ | `--text-xs` 12px 〜 `--text-2xl` 24px。**10px は使わない**（例外はボトムナビのラベルとカレンダー内αバッジの 11px） |
| 角丸 | `--radius-xs` 8px（バッジ）／`sm` 10px（セル）／`md` 12px／`lg` 18px（カード）／`xl` 24px（モーダル）／`full` |
| 影 | `--shadow-sm` 〜 `lg` は接地影＋拡散影の2層。ボトムナビ用に `--shadow-nav` |

守るべき原則。

- **枠線で囲まない。** 区切りは塗り・余白・影で作る。`border` を使うのは入力欄（`.form-input`）と表の罫線（`.work-table`）だけ
- **1つの色を2箇所まで。** バッジは「薄い塗り＋濃い文字」。枠線に同じ色を重ねない
- **状態はリングで示す。** 「今日」は `box-shadow: inset 0 0 0 2px`、「選択中」は外向きの `box-shadow: 0 0 0 2px`。形が違うので色が近くても混同しない。この方式にしたことで状態指定の `!important` が不要になった（残っているのは `prefers-reduced-motion` の4行だけ）
- **ウェイトは 400 / 500 / 600 / 700。** 800 は使わない
- **プライマリ上の文字は `--color-on-primary`。** ダークモードではプライマリが明色に反転するため `#fff` 固定は不可

### 明暗の出し分け

`@media (prefers-color-scheme: dark)` のブロックは作らない。**`light-dark(ライト値, ダーク値)` で1行にまとめる。**

```css
--color-bg: #f6f6f3;                       /* 非対応ブラウザ用のフォールバック */
--color-bg: light-dark(#f6f6f3, #15161a);  /* 対応ブラウザはこちらで上書き */
```

- 明暗の切り替えは `:root` の `color-scheme`。`data-mode="light" | "dark"` で明示指定し、**属性なし＝自動**（OS の設定に従う）
- 2行1組のフォールバックは必ず書く。`light-dark()` 非対応ブラウザは後段を捨ててライト値で止まる（壊れずに常時ライトになる）
- `filter` など色以外の値は `light-dark()` で書けないため、`--hover-brightness` のようにトークン化してモード別に指定する（現状これ1つだけ）
- シフト色は `colorVars()` が `--sc`/`--scd`/`--sbg`/`--sbgd` の4つを流し込み、CSS 側が `light-dark(var(--sc), var(--scd))` で選ぶ

### シフト色を変えるときの検証

`src/test/colors.test.js` が `npm test` で自動検証する。手で確認する必要はない。

- `color` と `bg` は**ライト・ダーク両方で 4.5:1 以上**
- **同じ配色を2種類で使わない。** 例外は「当直」のベースとα（付く場所が違うだけで同じ勤務のため意図的に同色）
- **ベースシフトの `bg` は明るさを揃える。** カレンダーのセル全体を塗るため、片方だけ濃いと月のパターンが不揃いに見える

色相の割り当ては埋まっている。

| 色相 | 種別 |
|------|------|
| 緑 | 日勤 |
| 青 | 早番・早番1・PM休 |
| 琥珀 | 遅番・会議 |
| ローズ | **夜勤**（濃い）・**明け休み**（彩度を落とした淡い） |
| 青緑 | 当直（ベース／α）・AM休 |
| スレート | 休み・未入力 |
| 赤 | 残業 |

**夜勤と明け休みは同じローズ系にする。** 夜勤の翌日に必ず明け休みが来るため、並んだときにペアと分かるほうがよい（利用者の要望）。夜勤 `#9d174d` が濃いローズ、明け休み `#8a4864` は彩度を落として「休み」であることを示す。休みが無彩色のスレートなので、明け休みは夜勤と休みの中間に位置づく。

- **別の色相にしない。** 一度ローズと紫に分けたが「もっと近い色に」と差し戻しになっている
- **完全な同色にもしない。** 内訳の積み上げバーとチップは `--sc`（文字色）で塗るため、同色だと夜勤と明け休みが1本の塊に見えて区別できなくなる

**夜勤は回数が多く一番読めてほしいため、他と重ならないローズを充てている**（以前は紫で見づらいという指摘があった）。

## コーディング規約

- コンポーネントは関数コンポーネント（`function Foo() {}`）、アロー関数は使わない
- CSS クラスは BEM 風（`calendar__cell--today`）
- スタイルはすべて `index.css`。インラインスタイルは色・背景などシフト種別依存の動的値のみ許容
- コメントは WHY が非自明な場合のみ（WHAT は書かない）
- Supabase エラーは `if (error) throw error` で即投げる

## デプロイ

Vercel に GitHub リポジトリを連携して自動デプロイ。`main` ブランチへの push でビルドが走る。環境変数は Vercel 管理画面の `Settings → Environment Variables` に設定する。
