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
| 型システム | 静的型付け | 動的型付け | 動的型付け（TypeScript で静的化も可） |
| メモリ管理 | 手動（malloc/free） | GC | GC |
| 標準出力 | `printf()` | `print()` | `console.log()` |

---

## 2. プロジェクト構造の読み方

### ビルドの流れ

C言語でいう `gcc main.c -o app` に相当するのが以下のコマンドです。

```bash
npm run build
```

内部では Vite というビルドツールが `.jsx` ファイルをブラウザが解釈できる `.js` に変換します。C言語のプリプロセッサ＋コンパイル＋リンクをまとめたようなものです。

### package.json の役割

Pythonでいう `requirements.txt` に相当します。依存ライブラリの一覧と、`npm run dev`（開発サーバー起動）などのショートカットコマンドを定義しています。

```json
{
  "scripts": {
    "dev":   "vite",        // python app.py に相当
    "build": "vite build",  // gcc でコンパイルするのに相当
    "test":  "vitest run"   // pytest に相当
  },
  "dependencies": {
    "react": "^18.2.0"      // requirements.txt の react==18.2.0 に相当
  }
}
```

### npm install の役割

```bash
npm install
```

Pythonでいう `pip install -r requirements.txt` です。`node_modules/` フォルダに依存ライブラリが展開されます。Gitには含めません（`.gitignore` に記載済み）。

---

## 3. JavaScript／JSXの文法対比

### 変数宣言

```javascript
// JavaScript
const name = "原田 真依";   // 変更不可（C の const に近い）
let count = 0;              // 変更可能
```

```python
# Python
name = "原田 真依"
count = 0
```

```c
// C
const char *name = "原田 真依";
int count = 0;
```

### 関数定義

JavaScriptには関数の書き方が複数あります。どちらも同じ意味です。

```javascript
// アロー関数（よく使われる）
const add = (a, b) => a + b;

// 従来の関数
function add(a, b) {
    return a + b;
}
```

```python
# Python
def add(a, b):
    return a + b
```

### 配列とオブジェクト

```javascript
// JavaScript
const arr = [1, 2, 3];               // Python の list に相当
const obj = { key: "早", label: "早番" }; // Python の dict に相当

// アクセス
arr[0];       // 1
obj.key;      // "早"
obj["key"];   // "早"（どちらも同じ）
```

```python
# Python
arr = [1, 2, 3]
obj = {"key": "早", "label": "早番"}

arr[0]        # 1
obj["key"]    # "早"
```

### 配列の操作（重要）

Reactのコードでは `for` ループより `map` / `filter` をよく使います。

```javascript
// map: 各要素を変換して新しい配列を作る
const days = [1, 2, 3];
const doubled = days.map(d => d * 2);  // [2, 4, 6]

// filter: 条件を満たす要素だけ残す
const even = days.filter(d => d % 2 === 0);  // [2]
```

```python
# Python で同じことをするなら
doubled = [d * 2 for d in days]
even = [d for d in days if d % 2 == 0]
```

### 非同期処理

```javascript
// JavaScript の async/await
const fetchData = async () => {
    const result = await someApiCall();  // 待機
    console.log(result);
};
```

```python
# Python の async/await（ほぼ同じ書き方）
import asyncio

async def fetch_data():
    result = await some_api_call()
    print(result)
```

---

## 4. JSXとは何か

`.jsx` ファイルの中には、JavaScriptの中にHTMLのような記述が混在しています。これを JSX と呼びます。

```jsx
// JSX（JavaScriptの中にHTMLが書ける）
function Greeting() {
    const name = "真依";
    return (
        <div style={{ color: "blue" }}>
            こんにちは、{name}さん
        </div>
    );
}
```

これはビルド時に以下のJavaScriptに変換されます（普段は意識しなくてよいです）。

```javascript
function Greeting() {
    const name = "真依";
    return React.createElement("div", { style: { color: "blue" } }, "こんにちは、" + name + "さん");
}
```

Pythonで例えるなら、Jinja2テンプレートのロジックとHTMLが同じファイルに共存しているイメージに近いです。

---

## 5. Reactのコンポーネントとは

コンポーネントは「UIの部品」です。C言語の関数、Pythonのクラスに相当します。

```jsx
// コンポーネントの定義（関数として書く）
function ShiftBadge({ shiftKey }) {        // 引数を「props」と呼ぶ
    return (
        <span style={{ color: "blue" }}>
            {shiftKey}
        </span>
    );
}

// 使う側
function App() {
    return (
        <div>
            <ShiftBadge shiftKey="早" />    // 関数呼び出しに相当
            <ShiftBadge shiftKey="夜" />
        </div>
    );
}
```

Pythonで例えると以下のようなイメージです。

```python
def shift_badge(shift_key):
    return f'<span style="color:blue">{shift_key}</span>'

def app():
    return shift_badge("早") + shift_badge("夜")
```

---

## 6. useState とは（状態管理）

ReactのコアはUIと状態の同期です。`useState` はグローバル変数に似ていますが、値が変わると自動的に画面が再描画されます。

```jsx
import { useState } from "react";

function Counter() {
    // [現在の値, 値を変更する関数] = useState(初期値)
    const [count, setCount] = useState(0);

    return (
        <button onClick={() => setCount(count + 1)}>
            {count} 回クリック
        </button>
    );
}
```

C言語で例えるなら、値を変更するたびに `render()` が自動で呼ばれる仕組みです。

```c
// C のイメージ（実際にはこうは書かない）
int count = 0;

void setCount(int new_value) {
    count = new_value;
    render();  // ← useState はこれを自動でやってくれる
}
```

---

## 7. useEffect とは（副作用処理）

`useEffect` は、特定の値が変わったときに実行される処理を登録します。C言語のコールバック関数、Pythonのイベントハンドラに近い概念です。

```jsx
import { useState, useEffect } from "react";

function App() {
    const [month, setMonth] = useState(5);
    const [shifts, setShifts] = useState({});

    // month が変わるたびに実行される
    useEffect(() => {
        const data = loadFromLocalStorage(month);
        setShifts(data);
    }, [month]);  // ← ここに書いた変数が変化したときに実行
}
```

Pythonで例えると以下のようなイメージです。

```python
# month が変わるたびに自動で呼ばれるイメージ
def on_month_changed(month):
    data = load_from_storage(month)
    update_shifts(data)
```

---

## 8. localStorage とは

ブラウザが提供するキーバリューストアです。Pythonでいう `shelve` やファイルへの保存に相当します。アプリを閉じても残りますが、ブラウザのデータ削除で消えます。

```javascript
// 保存
localStorage.setItem("shifts_2025_11", JSON.stringify({ "1": "早", "2": "夜" }));

// 読み込み
const raw = localStorage.getItem("shifts_2025_11");
const data = JSON.parse(raw);  // JSON文字列 → オブジェクト
```

```python
# Python で同じことをするなら（shelve 版）
import shelve
with shelve.open("shifts") as db:
    db["shifts_2025_11"] = {"1": "早", "2": "夜"}  # 保存
    data = db["shifts_2025_11"]                     # 読み込み
```

今後 Supabase（PostgreSQL）に移行すると、このlocalStorageへの読み書きをAPIコールに置き換えます。

---

## 9. 今後の実装予定と技術的な概要

### Supabase（データベース）

PostgreSQL をホスティングしたサービスです。Python から `psycopg2` や `SQLAlchemy` でDBに接続するのと同様に、JavaScript から Supabase クライアントライブラリで接続します。

```javascript
// Supabase へのデータ保存イメージ
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(URL, KEY);

await supabase.from("shifts").upsert({ year: 2025, month: 11, day: 1, shift_key: "早" });
```

```python
# Python + psycopg2 でのイメージ
conn = psycopg2.connect(DSN)
cur = conn.cursor()
cur.execute("INSERT INTO shifts (year, month, day, shift_key) VALUES (%s, %s, %s, %s) ON CONFLICT ...",
            (2025, 11, 1, "早"))
```

### Google カレンダー連携（iCal エクスポート）

iCal（.ics）はカレンダーデータの標準フォーマットです。テキストファイルを生成してダウンロードさせ、Google カレンダーにインポートします。

```
BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20251101
SUMMARY:早番
END:VEVENT
END:VCALENDAR
```

C言語でファイルを `fprintf` で書き出すのと本質的には同じです。

---

## 10. 開発を始めるときのコマンド早見表

```bash
# 初回セットアップ
npm install              # pip install -r requirements.txt 相当

# 開発サーバー起動（ファイル変更を自動検知して画面を更新）
npm run dev              # python app.py 相当
# → ブラウザで http://localhost:5173 を開く

# テスト実行
npm test                 # pytest 相当

# 本番ビルド（Vercel へのデプロイ前に自動実行される）
npm run build            # gcc でコンパイル相当
```

---

## 11. よくあるエラーと対処

| エラー | 意味 | 対処 |
|--------|------|------|
| `Cannot find module 'react'` | ライブラリが未インストール | `npm install` を実行 |
| `Uncaught ReferenceError: xxx is not defined` | 変数が未定義 | C の未宣言変数エラーと同じ |
| `Objects are not valid as a React child` | JSXの中にオブジェクトを直接書いた | `JSON.stringify(obj)` で文字列化する |
| `Warning: Each child in a list should have a unique "key" prop` | リスト描画でIDが未指定 | `map()` の中で `key={一意な値}` を付ける |
