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
    ├── setup.js        # @testing-library/jest-dom のセットアップ
    ├── App.test.jsx    # UI テスト 25 件
    └── ical.test.js    # iCal 単体テスト 7 件
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

## コーディング規約

- コンポーネントは関数コンポーネント（`function Foo() {}`）、アロー関数は使わない
- CSS クラスは BEM 風（`calendar__cell--today`）
- スタイルはすべて `index.css`。インラインスタイルは色・背景などシフト種別依存の動的値のみ許容
- コメントは WHY が非自明な場合のみ（WHAT は書かない）
- Supabase エラーは `if (error) throw error` で即投げる

## デプロイ

Vercel に GitHub リポジトリを連携して自動デプロイ。`main` ブランチへの push でビルドが走る。環境変数は Vercel 管理画面の `Settings → Environment Variables` に設定する。
