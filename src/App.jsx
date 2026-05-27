import { useState, useEffect, useCallback } from "react";
import { supabase, fetchShifts, saveShift } from "./supabase";
import { exportToICal } from "./ical";

// ベースシフト（1日1つだけ選択）
const BASE_SHIFTS = [
  { key: "日",  label: "日勤",     color: "#27AE60", bg: "#E9F7EF", start: "8:45",  end: "17:30" },
  { key: "早1", label: "早番1",    color: "#2E7BC4", bg: "#D6EAF8", start: "7:00",  end: "15:45" },
  { key: "早",  label: "早番",     color: "#4A90D9", bg: "#E8F4FD", start: "7:30",  end: "16:15" },
  { key: "遅",  label: "遅番",     color: "#E67E22", bg: "#FEF0E3", start: "10:15", end: "19:00" },
  { key: "夜",  label: "夜勤",     color: "#6C3483", bg: "#F4ECF7", start: "16:30", end: "翌9:30" },
  { key: "明",  label: "明け休み", color: "#8E44AD", bg: "#EDE0F5" },
  { key: "当",  label: "当直",     color: "#1ABC9C", bg: "#E8F8F5", start: "19:00", end: "翌7:00" },
  { key: "休",  label: "休み",     color: "#95A5A6", bg: "#F2F3F4" },
  { key: "",    label: "未入力",   color: "#BDC3C7", bg: "#FAFAFA" },
];

// αオプション（複数選択可）
const ALPHA_TYPES = [
  { key: "残", label: "残業", color: "#E74C3C", bg: "#FDEDEC" },
  { key: "会", label: "会議", color: "#F39C12", bg: "#FEF9E7" },
  { key: "当", label: "当直", color: "#9B59B6", bg: "#F5EEF8" },
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const UNAME = import.meta.env.VITE_USER_NAME || "ユーザ";

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

function getBaseInfo(key) {
  return BASE_SHIFTS.find(s => s.key === key) || BASE_SHIFTS[BASE_SHIFTS.length - 1];
}

function getAlphaInfo(key) {
  return ALPHA_TYPES.find(a => a.key === key);
}

// シフトバッジ（ベース用）
function ShiftBadge({ shiftKey, size = "sm" }) {
  const info = getBaseInfo(shiftKey);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: info.bg, color: info.color,
      border: `1.5px solid ${info.color}`,
      borderRadius: "6px", fontWeight: "700",
      fontSize: size === "sm" ? "11px" : "13px",
      padding: size === "sm" ? "1px 5px" : "3px 8px",
      minWidth: size === "sm" ? "28px" : "36px",
      whiteSpace: "nowrap",
    }}>
      {info.key || "－"}
    </span>
  );
}

// αバッジ（小）
function AlphaBadge({ alphaKey }) {
  const info = getAlphaInfo(alphaKey);
  if (!info) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: info.bg, color: info.color,
      border: `1px solid ${info.color}`,
      borderRadius: "4px", fontWeight: "700",
      fontSize: "9px",
      padding: "1px 3px",
      whiteSpace: "nowrap",
    }}>
      {info.label}
    </span>
  );
}


// シフト入力モード用パネル
function ShiftInputPanel({ inputShift, inputAlpha, selectedDates, onSelectShift, onToggleAlpha, onSave }) {
  return (
    <div
      data-testid="shift-input-panel"
      style={{
        background: "#fff", borderRadius: "14px", padding: "14px 12px",
        marginBottom: "14px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        border: "1.5px solid #E74C3C22",
      }}
    >
      {/* 選択状態サマリ */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", color: "#888" }}>選択中：</span>
        {inputShift
          ? <span data-testid="selected-shift-label" style={{
              fontSize: "12px", fontWeight: "700",
              color: getBaseInfo(inputShift).color,
              background: getBaseInfo(inputShift).bg,
              border: `1px solid ${getBaseInfo(inputShift).color}`,
              borderRadius: "6px", padding: "2px 8px",
            }}>{getBaseInfo(inputShift).label}</span>
          : <span style={{ fontSize: "12px", color: "#ccc" }}>シフト未選択</span>
        }
        {inputAlpha.length > 0 && (
          <span data-testid="selected-alpha-label" style={{ display: "flex", gap: "4px" }}>
            {inputAlpha.map(k => {
              const a = ALPHA_TYPES.find(x => x.key === k);
              return a ? (
                <span key={k} style={{
                  fontSize: "11px", fontWeight: "700", color: a.color,
                  background: a.bg, border: `1px solid ${a.color}`,
                  borderRadius: "4px", padding: "1px 5px",
                }}>{a.label}</span>
              ) : null;
            })}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#888" }}>
          日付：<span data-testid="selected-dates-count" style={{ fontWeight: "700", color: "#E74C3C" }}>
            {selectedDates.size}
          </span>件選択
        </span>
      </div>

      {/* ベースシフト選択 */}
      <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#888", fontWeight: "600" }}>シフト</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px", marginBottom: "10px" }}>
        {BASE_SHIFTS.filter(s => s.key).map(s => (
          <button
            key={s.key}
            data-shift={s.key}
            onClick={() => onSelectShift(s.key)}
            style={{
              padding: "8px 4px",
              border: `2px solid ${s.key === inputShift ? s.color : "#eee"}`,
              borderRadius: "8px",
              background: s.key === inputShift ? s.bg : "#fafafa",
              cursor: "pointer", fontSize: "11px", fontWeight: "600", color: s.color,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* αオプション */}
      <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#888", fontWeight: "600" }}>オプション（複数可）</p>
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {ALPHA_TYPES.map(a => {
          const active = inputAlpha.includes(a.key);
          return (
            <button
              key={a.key}
              data-alpha={a.key}
              onClick={() => onToggleAlpha(a.key)}
              style={{
                flex: 1, padding: "8px 4px",
                border: `2px solid ${active ? a.color : "#eee"}`,
                borderRadius: "8px",
                background: active ? a.bg : "#fafafa",
                cursor: "pointer", fontSize: "11px", fontWeight: "600", color: a.color,
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {/* 保存ボタン */}
      <button
        data-action="save"
        onClick={onSave}
        style={{
          width: "100%", padding: "11px",
          background: inputShift && selectedDates.size > 0 ? "#E74C3C" : "#ccc",
          border: "none", borderRadius: "10px",
          color: "#fff", fontWeight: "700", fontSize: "14px", cursor: "pointer",
        }}
      >
        保存（{selectedDates.size}件）
      </button>
    </div>
  );
}

function WorkTimeModal({ open, onClose }) {
  if (!open) return null;

  const thStyle = {
    borderBottom: "1px solid #ddd",
    padding: "8px 10px",
    fontSize: "13px",
    textAlign: "left",
    color: "#555",
  };
  const tdStyle = {
    borderBottom: "1px solid #eee",
    padding: "8px 10px",
    fontSize: "13px",
  };

  const rows = BASE_SHIFTS.filter(s => s.start);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: "14px",
          width: "90%", maxWidth: "380px",
          padding: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: "17px", fontWeight: "700", marginBottom: "14px" }}>
          勤務時間表
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>区分</th>
              <th style={thStyle}>開始</th>
              <th style={thStyle}>終了</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.key}>
                <td style={{ ...tdStyle, color: s.color, fontWeight: "600" }}>{s.label}</td>
                <td style={tdStyle}>{s.start}</td>
                <td style={tdStyle}>{s.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={onClose}
          style={{
            marginTop: "18px", width: "100%", padding: "10px",
            border: "none", borderRadius: "10px",
            background: "#4A90D9", color: "#fff",
            fontWeight: "700", cursor: "pointer", fontSize: "14px",
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

// シフト選択ポップアップ（ベース＋αの2段構成）
function ShiftPicker({ day, currentBase, currentAlpha, onSelect, onClose }) {
  const [selectedBase, setSelectedBase] = useState(currentBase);
  const [selectedAlpha, setSelectedAlpha] = useState(currentAlpha || []);

  const toggleAlpha = (key) => {
    setSelectedAlpha(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    onSelect(selectedBase, selectedAlpha);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: "16px", padding: "20px",
        width: "300px", boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
      }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: "0 0 14px", fontWeight: "700", fontSize: "15px", color: "#333" }}>
          {day}日のシフトを選択
        </p>

        {/* ベースシフト選択 */}
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#888", fontWeight: "600" }}>
          シフト
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "16px" }}>
          {BASE_SHIFTS.map(s => (
            <button key={s.key} onClick={() => setSelectedBase(s.key)} style={{
              padding: "10px 4px",
              border: `2px solid ${s.key === selectedBase ? s.color : "#eee"}`,
              borderRadius: "10px",
              background: s.key === selectedBase ? s.bg : "#fff",
              cursor: "pointer", fontSize: "12px", fontWeight: "600", color: s.color,
            }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* αオプション */}
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#888", fontWeight: "600" }}>
          オプション（複数選択可）
        </p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          {ALPHA_TYPES.map(a => {
            const active = selectedAlpha.includes(a.key);
            return (
              <button key={a.key} onClick={() => toggleAlpha(a.key)} style={{
                flex: 1, padding: "10px 4px",
                border: `2px solid ${active ? a.color : "#eee"}`,
                borderRadius: "10px",
                background: active ? a.bg : "#fff",
                cursor: "pointer", fontSize: "12px", fontWeight: "600", color: a.color,
              }}>
                {a.label}
              </button>
            );
          })}
        </div>

        {/* 保存ボタン */}
        <button onClick={handleSave} style={{
          width: "100%", padding: "12px",
          background: "#4A90D9", border: "none", borderRadius: "10px",
          color: "#fff", fontWeight: "700", fontSize: "14px", cursor: "pointer",
        }}>
          保存
        </button>
      </div>
    </div>
  );
}

// カレンダービュー
function CalendarView({ year, month, shifts, onDayClick, inputMode = false, selectedDates = new Set() }) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", marginBottom: "4px" }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{
            textAlign: "center", fontSize: "11px", fontWeight: "700",
            color: i === 0 ? "#e74c3c" : i === 6 ? "#4A90D9" : "#888",
            padding: "4px 0"
          }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const dow = (firstDay + d - 1) % 7;
          const entry = shifts[String(d)] || {};
          const shiftKey = entry.base ?? "";
          const alphaKeys = entry.alpha || [];
          const info = getBaseInfo(shiftKey);
          const isToday = isCurrentMonth && today.getDate() === d;
          const isSelected = inputMode && selectedDates.has(d);
          const borderColor = isSelected ? "#E74C3C" : isToday ? "#4A90D9" : "#eee";
          const borderWidth = isSelected || isToday ? "2px" : "1.5px";
          return (
            <div key={d} onClick={() => onDayClick(d)} style={{
              borderRadius: "8px", padding: "4px 2px",
              background: isSelected ? "#FDEDEC" : shiftKey ? info.bg : "#f9f9f9",
              border: `${borderWidth} solid ${borderColor}`,
              cursor: "pointer", minHeight: "58px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}>
              <span style={{
                fontSize: "12px", fontWeight: isToday ? "800" : "600",
                color: dow === 0 ? "#e74c3c" : dow === 6 ? "#4A90D9" : "#333"
              }}>{d}</span>
              {shiftKey
                ? <span style={{
                    fontSize: "11px", fontWeight: "700", color: info.color,
                    background: info.bg, border: `1px solid ${info.color}`,
                    borderRadius: "4px", padding: "1px 4px"
                  }}>{info.key}</span>
                : <span style={{ fontSize: "10px", color: "#ccc" }}>－</span>
              }
              {/* αバッジ：セル下部に横並び */}
              {alphaKeys.length > 0 && (
                <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", justifyContent: "center" }}>
                  {alphaKeys.map(k => <AlphaBadge key={k} alphaKey={k} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// リストビュー
function ListView({ year, month, shifts, onDayClick }) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {Array.from({ length: days }, (_, i) => i + 1).map(d => {
        const dow = (firstDay + d - 1) % 7;
        const entry = shifts[String(d)] || {};
        const shiftKey = entry.base ?? "";
        const alphaKeys = entry.alpha || [];
        const info = getBaseInfo(shiftKey);
        const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;
        return (
          <div key={d} onClick={() => onDayClick(d)} style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
            background: isToday ? "#EBF5FB" : shiftKey ? info.bg : "#fafafa",
            border: isToday ? "1.5px solid #4A90D9" : "1px solid #eee",
          }}>
            <span style={{
              width: "28px", fontSize: "14px", fontWeight: "700",
              color: dow === 0 ? "#e74c3c" : dow === 6 ? "#4A90D9" : "#333"
            }}>{d}</span>
            <span style={{ width: "18px", fontSize: "11px", color: "#aaa" }}>{WEEKDAYS[dow]}</span>
            <ShiftBadge shiftKey={shiftKey} size="md" />
            <span style={{ fontSize: "13px", color: "#666", flex: 1 }}>{info.label}</span>
            {/* αバッジ：右側に横並び */}
            {alphaKeys.length > 0 && (
              <div style={{ display: "flex", gap: "4px" }}>
                {alphaKeys.map(k => <AlphaBadge key={k} alphaKey={k} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 集計（ベースシフトのみ）
function SummaryCards({ shifts }) {
  // ベース集計
  const baseCounts = {};
  BASE_SHIFTS.forEach(s => {
    if (s.key) baseCounts[s.key] = 0;
  });

  // α集計
  const alphaCounts = {};
  ALPHA_TYPES.forEach(a => {
    if (a.key) alphaCounts[a.key] = 0;
  });

  // 集計
  Object.values(shifts).forEach(entry => {
    // base
    const base = entry?.base;
    if (base && baseCounts[base] !== undefined) {
      baseCounts[base]++;
    }

    // alpha（複数）
    const alphas = entry?.alpha || [];
    alphas.forEach(a => {
      if (alphaCounts[a] !== undefined) {
        alphaCounts[a]++;
      }
    });
  });

  const baseItems = BASE_SHIFTS.filter(
    s => s.key && baseCounts[s.key] > 0
  );

  const alphaItems = ALPHA_TYPES.filter(
    a => a.key && alphaCounts[a.key] > 0
  );

  if (baseItems.length === 0 && alphaItems.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
        gap: "8px",
        marginBottom: "14px"
      }}
    >
      {/* base */}
      {baseItems.map(s => (
        <div
          key={s.key}
          style={{
            background: s.bg,
            border: `1.5px solid ${s.color}`,
            borderRadius: "10px",
            padding: "10px 8px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "800",
              color: s.color
            }}
          >
            {baseCounts[s.key]}
          </div>

          <div
            style={{
              fontSize: "11px",
              color: s.color,
              fontWeight: "600"
            }}
          >
            {s.label}
          </div>
        </div>
      ))}

      {/* alpha */}
      {alphaItems.map(a => (
        <div
          key={a.key}
          style={{
            background: a.bg,
            border: `1.5px solid ${a.color}`,
            borderRadius: "10px",
            padding: "10px 8px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "800",
              color: a.color
            }}
          >
            {alphaCounts[a.key]}
          </div>

          <div
            style={{
              fontSize: "11px",
              color: a.color,
              fontWeight: "600"
            }}
          >
            {a.label}
          </div>
        </div>
      ))}
    </div>
  );
}
export default function App({ session }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  // shifts の形式: { "1": { base: "日", alpha: ["残", "会"] }, ... }
  const [shifts, setShifts] = useState({});
  const [view, setView] = useState("calendar");
  const [picker, setPicker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showWorkTable, setShowWorkTable] = useState(false);
  const [inputMode, setInputMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [inputShift, setInputShift] = useState("");
  const [inputAlpha, setInputAlpha] = useState([]);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShifts(year, month);
      setShifts(data);
    } catch (e) {
      setError("データの読み込みに失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const handleShiftSelect = async (day, base, alpha) => {
    const prev = shifts[String(day)];
    setShifts(s => ({ ...s, [String(day)]: { base, alpha } }));
    setSaving(true);
    try {
      await saveShift(year, month, day, base, alpha);
    } catch (e) {
      setError("保存に失敗しました");
      setShifts(s => ({ ...s, [String(day)]: prev }));
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // 入力モード: トグル（モード切替時にリセット）
  const toggleInputMode = () => {
    setInputMode(prev => {
      if (prev) {
        setSelectedDates(new Set());
        setInputShift("");
        setInputAlpha([]);
      }
      return !prev;
    });
  };

  // 入力モード: 日付のトグル選択
  const toggleDateSelection = (day) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  // 入力モード: αオプションのトグル
  const toggleInputAlpha = (key) => {
    setInputAlpha(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // 入力モード: 一括保存
  const handleBulkSave = async () => {
    if (!inputShift || selectedDates.size === 0) return;
    const days = Array.from(selectedDates);
    // 楽観的更新
    setShifts(prev => {
      const next = { ...prev };
      days.forEach(d => { next[String(d)] = { base: inputShift, alpha: inputAlpha }; });
      return next;
    });
    setSelectedDates(new Set());
    setInputShift("");
    setInputAlpha([]);
    setSaving(true);
    try {
      await Promise.all(days.map(d => saveShift(year, month, d, inputShift, inputAlpha)));
    } catch (e) {
      setError("保存に失敗しました");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // カレンダー日付クリック（通常 / 入力モードで分岐）
  const handleDayClick = (day) => {
    if (inputMode) {
      toggleDateSelection(day);
    } else {
      setPicker(day);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // 次の出勤日
  let nextWork = null;
  if (today.getFullYear() === year && today.getMonth() + 1 === month) {
    const days = getDaysInMonth(year, month);
    for (let d = today.getDate(); d <= days; d++) {
      const entry = shifts[String(d)];
      const base = entry?.base;
      if (base && base !== "休") { nextWork = { day: d, base, alpha: entry.alpha || [] }; break; }
    }
  }

  const pickerEntry = picker ? (shifts[String(picker)] || {}) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4f8 0%, #e8eef5 100%)",
      fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif",
      paddingBottom: "40px"
    }}>
      {/* ヘッダー */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        color: "#fff", padding: "16px 16px 14px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#7fb3d3", marginBottom: "2px" }}>シフト管理</div>
            <div style={{ fontSize: "20px", fontWeight: "800" }}>{UNAME}</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {saving && <span style={{ fontSize: "11px", color: "#7fb3d3" }}>保存中...</span>}

            {/* 入力モードトグル */}
            <button
              onClick={toggleInputMode}
              aria-label={inputMode ? "入力モード終了" : "入力モード開始"}
              style={{
                background: inputMode ? "#E74C3C" : "rgba(255,255,255,0.15)",
                border: "none", borderRadius: "10px",
                color: "#fff", padding: "8px 12px", cursor: "pointer",
                fontSize: "12px", fontWeight: "700",
              }}
            >
              {inputMode ? "✏️ 入力中" : "✏️ 入力モード"}
            </button>

            {/* 追加：勤務時間表ボタン */}
            <button onClick={() => setShowWorkTable(true)} style={{
              background: "#27AE60", border: "none", borderRadius: "10px",
              color: "#fff", padding: "8px 12px", cursor: "pointer",
              fontSize: "12px", fontWeight: "700"
            }}>
              🕐 勤務時間表
            </button>

            <button onClick={() => exportToICal(year, month, shifts)} style={{
              background: "#1ABC9C", border: "none", borderRadius: "10px",
              color: "#fff", padding: "8px 12px", cursor: "pointer",
              fontSize: "12px", fontWeight: "700"
            }}>
              📅 カレンダー出力
            </button>

            {/* ログアウト */}
            <button onClick={async () => { await supabase.auth.signOut(); }} style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "10px",
              color: "#fff", padding: "8px 12px", cursor: "pointer",
              fontSize: "12px", fontWeight: "700"
            }}>
              🚪 ログアウト
            </button>
          </div>
        </div>

        {/* 月ナビ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px" }}>
          <button onClick={prevMonth} style={{
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px",
            color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px"
          }}>‹</button>
          <span style={{ fontSize: "20px", fontWeight: "800", minWidth: "130px", textAlign: "center" }}>
            {year}年{month}月
          </span>
          <button onClick={nextMonth} style={{
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px",
            color: "#fff", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px"
          }}>›</button>
        </div>
      </div>

      <div style={{ padding: "14px 12px" }}>
        {error && (
          <div style={{
            background: "#FDEDEC", border: "1.5px solid #e74c3c", borderRadius: "10px",
            padding: "10px 14px", marginBottom: "12px", fontSize: "13px", color: "#e74c3c",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            {error}
            <button onClick={() => setError(null)} style={{
              background: "none", border: "none", cursor: "pointer", color: "#e74c3c", fontSize: "16px"
            }}>×</button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "30px", color: "#888", fontSize: "14px" }}>
            読み込み中...
          </div>
        )}

        {!loading && (
          <>
            {/* 次の出勤 */}
            {nextWork && (
              <div style={{
                background: "#fff", borderRadius: "12px", padding: "12px 16px",
                marginBottom: "14px", border: "1.5px solid #E8F4FD",
                display: "flex", alignItems: "center", gap: "12px",
                boxShadow: "0 2px 10px rgba(74,144,217,0.1)"
              }}>
                <span style={{ fontSize: "22px" }}>📅</span>
                <div>
                  <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>次の出勤</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a2e", display: "flex", alignItems: "center", gap: "8px" }}>
                    {month}月{nextWork.day}日
                    <ShiftBadge shiftKey={nextWork.base} size="md" />
                    {nextWork.alpha.map(k => <AlphaBadge key={k} alphaKey={k} />)}
                  </div>
                </div>
              </div>
            )}

            {/* ビュー切替 */}
            <div style={{
              display: "flex", background: "#fff", borderRadius: "10px",
              padding: "3px", marginBottom: "14px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
            }}>
              {[["calendar", "📅 カレンダー"], ["list", "📋 リスト"]].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  flex: 1, padding: "8px", border: "none", borderRadius: "8px",
                  background: view === v ? "#4A90D9" : "transparent",
                  color: view === v ? "#fff" : "#666",
                  cursor: "pointer", fontSize: "13px", fontWeight: "600",
                  transition: "all 0.2s"
                }}>{label}</button>
              ))}
            </div>

            {inputMode && (
              <ShiftInputPanel
                inputShift={inputShift}
                inputAlpha={inputAlpha}
                selectedDates={selectedDates}
                onSelectShift={setInputShift}
                onToggleAlpha={toggleInputAlpha}
                onSave={handleBulkSave}
              />
            )}

            <div style={{
              background: "#fff", borderRadius: "14px", padding: "14px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
            }}>
              {view === "calendar"
                ? <CalendarView year={year} month={month} shifts={shifts} onDayClick={handleDayClick} inputMode={inputMode} selectedDates={selectedDates} />
                : <ListView year={year} month={month} shifts={shifts} onDayClick={handleDayClick} />
              }
            </div>

            <p style={{ textAlign: "center", fontSize: "11px", color: "#bbb", marginTop: "12px" }}>
              日付をタップしてシフトを入力できます
            </p>
          </>
          
        )}
      </div>

      <SummaryCards shifts={shifts} />

      {/* 追加：モーダル */}
      <WorkTimeModal open={showWorkTable} onClose={() => setShowWorkTable(false)} />


      {!inputMode && picker && (
        <ShiftPicker
          day={picker}
          currentBase={pickerEntry?.base ?? ""}
          currentAlpha={pickerEntry?.alpha ?? []}
          onSelect={(base, alpha) => handleShiftSelect(picker, base, alpha)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
