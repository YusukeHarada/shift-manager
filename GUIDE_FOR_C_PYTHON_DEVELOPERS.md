# C言語・Python開発者向け コード解説書

## はじめに

このドキュメントは、C言語やPythonの経験はあるがReact／JavaScriptは初めてという開発者向けに、本アプリのコードを解説します。「あの概念はこれに相当する」という対比を中心に説明します。

---

## 1. 言語・実行環境の対比

| 項目 | C言語 | Python | このアプリ（JavaScript/React） |
|------|-------|--------|-------------------------------|
| 実行環境 | OS上で直接実行 | インタープリタ | ブラウザ上で実行 |
| コンパイル | 必要（gcc等） | 不要 | ビルドツール（Vite）で変換 |
| エントリーポイント | `main()` | スクリプト先頭 | `src/main.jsx` |
| 型システム | 静的型付け | 動的型付け | 動的型付け |
| メモリ管理 | 手動（malloc/free） | GC | GC |
| 標準出力 | `printf()` | `print()` | `console.log()` |

---

## 2. プロジェクト構造の読み方

### ビルドの流れ

C言語でいう `gcc main.c -o app` に相当するのが以下のコマンドです。

```bash
npm run build
```

内部では Vite というビルドツールが `.jsx` ファイルをブラウザが解釈できる `.js` に変換します。

### package.json の役割

Pythonでいう `requirements.txt` に相当します。依存ライブラリの一覧と実行コマンドを定義しています。

```json
{
  "scripts": {
    "dev":   "vite",        // python app.py に相当
    "build": "vite build",  // gcc でコンパイルするのに相当
    "test":  "vitest run"   // pytest に相当
  },
  "dependencies": {
    "react": "^18.2.0",              // requirements.txt の react==18.x に相当
    "@supabase/supabase-js": "..."   // DB接続ライブラリ
  }
}
```

### package-lock.json の役割

`pip freeze > requirements.txt` の出力に近いものです。インストールされた全ライブラリの正確なバージョンを記録しています。Gitの管理対象に含めることで、別の環境でも同じバージョンが入ることを保証します。

### npm install の役割

```bash
npm install   # pip install -r requirements.txt に相当
```

`node_modules/` フォルダに依存ライブラリが展開されます。Gitには含めません（`.gitignore` に記載済み）。

### 環境変数（.env.local）

Pythonでいう `os.environ` や `dotenv` と同じ仕組みです。APIキーなど秘密情報をコードに直書きせず、`.env.local` ファイルに書いて読み込みます。

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=sb_publishable_...
```

コード側では `import.meta.env.VITE_SUPABASE_URL` で参照します。Pythonの `os.environ["DB_URL"]` に相当します。

---

## 3. JavaScript／JSXの文法対比

### 変数宣言

```javascript
const name = "ユーザ";   // 変更不可（C の const に近い）
let count = 0;           // 変更可能
```

### 関数定義

```javascript
// アロー関数（よく使われる）
const add = (a, b) => a + b;

// 従来の関数
function add(a, b) { return a + b; }
```

### 配列とオブジェクト

```javascript
const arr = [1, 2, 3];                         // Python の list
const obj = { base: "早", alpha: ["残", "会"] }; // Python の dict

arr[0];       // 1
obj.base;     // "早"
obj["base"];  // "早"（どちらも同じ）
```

### 配列操作（forループの代わりによく使う）

```javascript
// map: 変換して新しい配列を作る
const days = [1, 2, 3];
const doubled = days.map(d => d * 2);          // [2, 4, 6]

// filter: 条件を満たす要素だけ残す
const even = days.filter(d => d % 2 === 0);    // [2]

// Object.entries: dictのitemsに相当
Object.entries({ "1": "早", "2": "夜" })
// → [["1", "早"], ["2", "夜"]]
```

```python
# Python での同等処理
doubled = [d * 2 for d in days]
even = [d for d in days if d % 2 == 0]
{"1": "早", "2": "夜"}.items()
```

### 非同期処理

```javascript
// JavaScript
const load = async () => {
    const data = await fetchShifts(year, month);  // 完了まで待機
    setShifts(data);
};
```

```python
# Python（書き方はほぼ同じ）
async def load():
    data = await fetch_shifts(year, month)
    update_shifts(data)
```

---

## 4. JSXとは何か

`.jsx` ファイルの中には、JavaScriptの中にHTMLのような記述が混在しています。これを JSX と呼びます。

```jsx
function ShiftBadge({ shiftKey }) {
    return (
        <span style={{ color: "blue" }}>
            {shiftKey}        // {} の中はJavaScriptの式
        </span>
    );
}
```

Pythonで例えるなら、Jinja2テンプレートのロジックとHTMLが同じファイルに共存しているイメージです。

---

## 5. Reactのコンポーネントとは

コンポーネントは「UIの部品」です。C言語の関数、Pythonのクラスに相当します。

```jsx
// 定義
function ShiftBadge({ shiftKey }) {   // 引数を「props」と呼ぶ
    return <span>{shiftKey}</span>;
}

// 使う側
function App() {
    return (
        <div>
            <ShiftBadge shiftKey="早" />   // 関数呼び出しに相当
            <ShiftBadge shiftKey="夜" />
        </div>
    );
}
```

---

## 6. useState とは（状態管理）

値が変わると自動的に画面が再描画されるグローバル変数のようなものです。

```jsx
const [count, setCount] = useState(0);  // [現在値, 更新関数]

// setCount を呼ぶと画面が自動再描画される
<button onClick={() => setCount(count + 1)}>
    {count} 回クリック
</button>
```

本アプリでの使用例：

```jsx
const [shifts, setShifts] = useState({});   // 当月のシフトデータ
const [loading, setLoading] = useState(false); // 読み込み中フラグ
const [error, setError] = useState(null);      // エラーメッセージ
```

---

## 7. useEffect とは（副作用処理）

特定の値が変わったときに自動で実行される処理を登録します。

```jsx
// month が変わるたびに Supabase からデータを取得する
useEffect(() => {
    loadShifts();
}, [year, month]);  // ← ここに書いた変数が変化したときに実行
```

Pythonで例えると「month が変わるたびに自動で呼ばれるコールバック関数」のイメージです。

---

## 8. Supabase との通信

PostgreSQL をホスティングしたサービスです。`supabase.js` に接続処理をまとめています。

```javascript
// supabase.js

// 接続（psycopg2.connect() に相当）
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// データ取得（SELECT に相当）
const { data, error } = await supabase
    .from("shifts")
    .select("day, shift_key, alpha")
    .eq("year", year)
    .eq("month", month);

// データ保存（INSERT ... ON CONFLICT DO UPDATE に相当）
await supabase.from("shifts").upsert(
    { year, month, day, shift_key, alpha },
    { onConflict: "year,month,day" }
);
```

```python
# Python + psycopg2 での同等処理
cur.execute(
    "SELECT day, shift_key, alpha FROM shifts WHERE year=%s AND month=%s",
    (year, month)
)
cur.execute(
    "INSERT INTO shifts (year,month,day,shift_key,alpha) VALUES (%s,%s,%s,%s,%s)"
    " ON CONFLICT (year,month,day) DO UPDATE SET shift_key=EXCLUDED.shift_key",
    (year, month, day, shift_key, alpha)
)
```

---

## 9. iCal エクスポート（ical.js）

iCal（.ics）はカレンダーデータの標準テキストフォーマットです。C言語の `fprintf` でファイルを書き出すのと本質的に同じです。

```javascript
// 文字列を組み立ててファイルとしてダウンロードさせる
const lines = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:20251101`,
    `SUMMARY:早番`,
    "END:VEVENT",
    "END:VCALENDAR",
];
const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
```

αオプションがある場合は同じ日に複数のイベントとして出力されます。

---

## 10. テストの仕組み

### 使用ツール

| ツール | 役割 | Pythonの対応 |
|--------|------|-------------|
| Vitest | テストランナー | pytest |
| @testing-library/react | UIのレンダリング・操作 | - |
| jsdom | ブラウザのDOM環境をシミュレート | - |

### モック（外部依存の差し替え）

Supabase（DB接続）と iCal（ファイルダウンロード）はテスト中に実際に動かしたくないため、モックに差し替えます。Pythonでいう `unittest.mock.patch` に相当します。

```javascript
// __mocks__/supabase.js
export const fetchShifts = vi.fn().mockResolvedValue({});  // 常に空データを返す
export const saveShift = vi.fn().mockResolvedValue(undefined);  // 何もしない

// テストファイル
vi.mock("../supabase", () => supabaseMock);  // 本物のsupabase.jsをモックに差し替え
```

```python
# Python での同等処理
with unittest.mock.patch("myapp.supabase.fetch_shifts", return_value={}):
    result = run_test()
```

### 非同期UIのテスト

Supabaseからのデータ取得は非同期なので、ローディングが完了するまで待機してからアサートします。

```javascript
const renderAndWait = async () => {
    render(<App />);
    await waitFor(() => {
        // 「読み込み中...」が消えるまで待つ
        expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });
};
```

---

## 11. 開発コマンド早見表

```bash
npm install       # pip install -r requirements.txt
npm run dev       # python app.py（開発サーバー起動）
npm test          # pytest
npm run build     # gcc（本番ビルド）
```

---

## 12. よくあるエラーと対処

| エラー | 意味 | 対処 |
|--------|------|------|
| `Cannot find module 'react'` | ライブラリ未インストール | `npm install` を実行 |
| `Uncaught ReferenceError: xxx is not defined` | 変数が未定義 | C の未宣言変数エラーと同じ |
| `Objects are not valid as a React child` | JSXの中にオブジェクトを直接書いた | `JSON.stringify(obj)` で文字列化 |
| `Warning: Each child in a list should have a unique "key" prop` | リスト描画でIDが未指定 | `map()` の中で `key={一意な値}` を付ける |
| `import.meta.env.VITE_xxx is undefined` | 環境変数が未設定 | `.env.local` を作成して変数を記入 |
