// シフト種別の定義。App.jsx と analysis.js の両方が参照するため独立したモジュールに置く
// （App.jsx に置くと analysis.js との間で循環 import になる）。
// App.jsx から再 export しているので、従来どおり "./App" からも読める。

// color は bg の上で 4.5:1 以上になる濃さに揃えている（薄い塗り＋濃い文字）。
// bg はカレンダーのセル全体を塗るため、月のパターンが一目で掴めるよう
// 8種が同じくらいの濃さになるよう揃えている
export const BASE_SHIFTS = [
  { key: "日",  label: "日勤",     color: "#136b33", bg: "#dcf3e4", darkColor: "#4ade80", darkBg: "#15291d", start: "8:45",  end: "17:30" },
  { key: "早1", label: "早番1",    color: "#175e9e", bg: "#dde9f8", darkColor: "#38bdf8", darkBg: "#12293b", start: "7:00",  end: "15:45" },
  { key: "早",  label: "早番",     color: "#1d4ed8", bg: "#d6e2fb", darkColor: "#818cf8", darkBg: "#1e2142", start: "7:30",  end: "16:15" },
  { key: "遅",  label: "遅番",     color: "#99460a", bg: "#fbeed0", darkColor: "#fbbf24", darkBg: "#392c10", start: "10:15", end: "19:00" },
  // 夜勤は回数が多く一番読めてほしい。青系は早番・早番1・土曜で埋まっているためローズを充てている
  { key: "夜",  label: "夜勤",     color: "#9d174d", bg: "#f9d9e6", darkColor: "#f7a8cb", darkBg: "#401329", start: "16:30", end: "翌9:30" },
  // 夜勤の翌日に必ず来るのでローズ系で揃え、彩度を落として「休み」であることを示す。
  // 完全に同色にすると内訳のバーとチップで夜勤と区別できなくなる
  { key: "明",  label: "明け休み", color: "#8a4864", bg: "#f0dee6", darkColor: "#e5b3c6", darkBg: "#45333d" },
  // 休み・未入力は中性色のため、枠線なしでは未入力セルの背景と紛れる。塗りに差をつけている
  { key: "休",  label: "休み",     color: "#4b5563", bg: "#d9e0ea", darkColor: "#b3bdca", darkBg: "#313a46" },
  { key: "",    label: "未入力",   color: "#5f6773", bg: "#eef0f3", darkColor: "#a5adb9", darkBg: "#2f333a" },
];

export const ALPHA_TYPES = [
  { key: "残", label: "残業", color: "#b91c1c", bg: "#fef2f2", darkColor: "#f87171", darkBg: "#3a1a17" },
  { key: "会", label: "会議", color: "#b45309", bg: "#fffbeb", darkColor: "#fbbf24", darkBg: "#392c10" },
  // 当直はαだけで扱う（ベースシフトからは削除済み）。勤務時間表に出すため start/end を持つ
  { key: "当", label: "当直", color: "#0f766e", bg: "#d5f0ea", darkColor: "#2dd4bf", darkBg: "#0f2b28", start: "19:00", end: "翌7:00" },
  { key: "前休", label: "AM休", color: "#0e7490", bg: "#ecfeff", darkColor: "#22d3ee", darkBg: "#0e2c33", group: "half" },
  { key: "後休", label: "PM休", color: "#0369a1", bg: "#f0f9ff", darkColor: "#38bdf8", darkBg: "#0f2739", group: "half" },
];
