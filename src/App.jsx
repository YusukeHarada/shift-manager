import { useState, useEffect, useCallback } from "react";
import { fetchShifts, saveShift } from "./supabase";
import { exportToICal } from "./ical";

const SHIFT_TYPES = [
  { key: "早",  label: "早番",     color: "#4A90D9", bg: "#E8F4FD" },
  { key: "早1", label: "早番1",    color: "#2E7BC4", bg: "#D6EAF8" },
  { key: "遅",  label: "遅番",     color: "#E67E22", bg: "#FEF0E3" },
  { key: "夜",  label: "夜勤",     color: "#6C3483", bg: "#F4ECF7" },
  { key: "明",  label: "明け休み", color: "#8E44AD", bg: "#EDE0F5" },
  { key: "当",  label: "当直",     color: "#1ABC9C", bg: "#E8F8F5" },
  { key: "休",  label: "休み",     color: "#95A5A6", bg: "#F2F3F4" },
  { key: "α",   label: "残業",     color: "#E74C3C", bg: "#FDEDEC" },
  { key: "会",  label: "会議",     color: "#F39C12", bg: "#FEF9E7" },
  { key: "",    label: "未入力",   color: "#BDC3C7", bg: "#FAFAFA" },
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

function getShiftInfo(key) {
  return SHIFT_TYPES.find(s => s.key === key) || SHIFT_TYPES[SHIFT_TYPES.length - 1];
}

// シフトバッジ
function ShiftBadge({ shiftKey, size = "sm" }) {
  const info = getShiftInfo(shiftKey);
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

// シフト選択ポップアップ
function ShiftPicker({ day, current, onSelect, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: "16px", padding: "20px",
        width: "290px", boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
      }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: "0 0 14px", fontWeight: "700", fontSize: "15px", color: "#333" }}>
          {day}日のシフトを選択
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {SHIFT_TYPES.map(s => (
            <button key={s.key} onClick={() => { onSelect(s.key); onClose(); }} style={{
              padding: "12px 8px",
              border: `2px solid ${s.key === current ? s.color : "#eee"}`,
              borderRadius: "10px",
              background: s.key === current ? s.bg : "#fff",
              cursor: "pointer", fontSize: "13px", fontWeight: "600", color: s.color,
            }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// カレンダービュー
function CalendarView({ year, month, shifts, onDayClick }) {
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
          const shiftKey = shifts[String(d)] ?? "";
          const info = getShiftInfo(shiftKey);
          const isToday = isCurrentMonth && today.getDate() === d;
          return (
            <div key={d} onClick={() => onDayClick(d)} style={{
              borderRadius: "8px", padding: "6px 2px",
              background: shiftKey ? info.bg : "#f9f9f9",
              border: isToday ? "2px solid #4A90D9" : "1.5px solid #eee",
              cursor: "pointer", minHeight: "54px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
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
        const shiftKey = shifts[String(d)] ?? "";
        const info = getShiftInfo(shiftKey);
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
            <span style={{ fontSize: "13px", color: "#666" }}>{info.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// 集計
function SummaryCards({ shifts }) {
  const counts = {};
  SHIFT_TYPES.forEach(s => { if (s.key) counts[s.key] = 0; });
  Object.values(shifts).forEach(s => { if (s && counts[s] !== undefined) counts[s]++; });
  const items = SHIFT_TYPES.filter(s => s.key && counts[s.key] > 0);
  if (items.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
      {items.map(s => (
        <div key={s.key} style={{
          background: s.bg, border: `1.5px solid ${s.color}`,
          borderRadius: "10px", padding: "10px 8px", textAlign: "center"
        }}>
          <div style={{ fontSize: "20px", fontWeight: "800", color: s.color }}>{counts[s.key]}</div>
          <div style={{ fontSize: "11px", color: s.color, fontWeight: "600" }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [shifts, setShifts] = useState({});
  const [view, setView] = useState("calendar");
  const [picker, setPicker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // 月が変わったらSupabaseから読み込み
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

  // シフトを選択したらSupabaseに保存
  const handleShiftSelect = async (day, shiftKey) => {
    // 画面は即時更新
    setShifts(prev => ({ ...prev, [String(day)]: shiftKey }));
    setSaving(true);
    try {
      await saveShift(year, month, day, shiftKey);
    } catch (e) {
      setError("保存に失敗しました");
      // 失敗したら元に戻す
      setShifts(prev => ({ ...prev, [String(day)]: shifts[String(day)] ?? "" }));
      console.error(e);
    } finally {
      setSaving(false);
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
      const s = shifts[String(d)];
      if (s && s !== "休") { nextWork = { day: d, shift: s }; break; }
    }
  }

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
            <div style={{ fontSize: "20px", fontWeight: "800" }}>原田 真依</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {saving && <span style={{ fontSize: "11px", color: "#7fb3d3" }}>保存中...</span>}
            <button onClick={() => exportToICal(year, month, shifts)} style={{
              background: "#1ABC9C", border: "none", borderRadius: "10px",
              color: "#fff", padding: "8px 12px", cursor: "pointer",
              fontSize: "12px", fontWeight: "700"
            }}>
              📅 カレンダー出力
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
        {/* エラー表示 */}
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

        {/* ローディング */}
        {loading && (
          <div style={{
            textAlign: "center", padding: "30px", color: "#888", fontSize: "14px"
          }}>読み込み中...</div>
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
                    <ShiftBadge shiftKey={nextWork.shift} size="md" />
                  </div>
                </div>
              </div>
            )}

            {/* 集計 */}
            <SummaryCards shifts={shifts} />

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

            {/* メインビュー */}
            <div style={{
              background: "#fff", borderRadius: "14px", padding: "14px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
            }}>
              {view === "calendar"
                ? <CalendarView year={year} month={month} shifts={shifts} onDayClick={setPicker} />
                : <ListView year={year} month={month} shifts={shifts} onDayClick={setPicker} />
              }
            </div>

            <p style={{ textAlign: "center", fontSize: "11px", color: "#bbb", marginTop: "12px" }}>
              日付をタップしてシフトを入力できます
            </p>
          </>
        )}
      </div>

      {/* シフトピッカー */}
      {picker && (
        <ShiftPicker
          day={picker}
          current={shifts[String(picker)] ?? ""}
          onSelect={(s) => handleShiftSelect(picker, s)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
