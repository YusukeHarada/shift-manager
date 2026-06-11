import { useState, useEffect, useCallback, memo } from "react";
import { supabase, fetchShifts, saveShift } from "./supabase";
import { exportToICal } from "./ical";

const BASE_SHIFTS = [
  { key: "日",  label: "日勤",     color: "#16a34a", bg: "#f0fdf4", start: "8:45",  end: "17:30" },
  { key: "早1", label: "早番1",    color: "#1d6fb7", bg: "#eff6ff", start: "7:00",  end: "15:45" },
  { key: "早",  label: "早番",     color: "#2563eb", bg: "#dbeafe", start: "7:30",  end: "16:15" },
  { key: "遅",  label: "遅番",     color: "#d97706", bg: "#fffbeb", start: "10:15", end: "19:00" },
  { key: "夜",  label: "夜勤",     color: "#7c3aed", bg: "#f5f3ff", start: "16:30", end: "翌9:30" },
  { key: "明",  label: "明け休み", color: "#9333ea", bg: "#fdf4ff" },
  { key: "当",  label: "当直",     color: "#0d9488", bg: "#f0fdfa", start: "19:00", end: "翌7:00" },
  { key: "休",  label: "休み",     color: "#94a3b8", bg: "#f8fafc" },
  { key: "",    label: "未入力",   color: "#cbd5e1", bg: "#f8fafc" },
];

const ALPHA_TYPES = [
  { key: "残", label: "残業", color: "#dc2626", bg: "#fef2f2" },
  { key: "会", label: "会議", color: "#d97706", bg: "#fffbeb" },
  { key: "当", label: "当直", color: "#7c3aed", bg: "#f5f3ff" },
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

const ShiftBadge = memo(function ShiftBadge({ shiftKey, size = "sm" }) {
  const info = getBaseInfo(shiftKey);
  return (
    <span
      className={`shift-badge shift-badge--${size}`}
      style={{ background: info.bg, color: info.color, borderColor: info.color }}
    >
      {info.key || "－"}
    </span>
  );
});

const AlphaBadge = memo(function AlphaBadge({ alphaKey }) {
  const info = getAlphaInfo(alphaKey);
  if (!info) return null;
  return (
    <span
      className="alpha-badge"
      style={{ background: info.bg, color: info.color, borderColor: info.color }}
    >
      {info.label}
    </span>
  );
});

function ShiftInputPanel({ inputShift, inputAlpha, selectedDates, onSelectShift, onToggleAlpha, onSave }) {
  const shiftInfo = inputShift ? getBaseInfo(inputShift) : null;
  return (
    <div data-testid="shift-input-panel" className="input-panel">
      <div className="input-panel__summary">
        <span>選択中：</span>
        {shiftInfo
          ? <span data-testid="selected-shift-label" style={{
              fontSize: "12px", fontWeight: "700",
              color: shiftInfo.color, background: shiftInfo.bg,
              border: `1px solid ${shiftInfo.color}`,
              borderRadius: "6px", padding: "2px 8px",
            }}>{shiftInfo.label}</span>
          : <span style={{ color: "#cbd5e1" }}>シフト未選択</span>
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
        <span style={{ marginLeft: "auto" }}>
          日付：<span data-testid="selected-dates-count" style={{ fontWeight: "700", color: "#ef4444" }}>
            {selectedDates.size}
          </span>件
        </span>
      </div>

      <div className="input-panel__section-label">シフト</div>
      <div className="input-panel__shift-grid">
        {BASE_SHIFTS.filter(s => s.key).map(s => (
          <button
            key={s.key}
            data-shift={s.key}
            onClick={() => onSelectShift(s.key)}
            className="input-panel__shift-btn"
            style={{
              borderColor: s.key === inputShift ? s.color : "#e2e8f0",
              background: s.key === inputShift ? s.bg : "#f8fafc",
              color: s.color,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="input-panel__section-label">オプション（複数可）</div>
      <div className="input-panel__alpha-row">
        {ALPHA_TYPES.map(a => {
          const active = inputAlpha.includes(a.key);
          return (
            <button
              key={a.key}
              data-alpha={a.key}
              onClick={() => onToggleAlpha(a.key)}
              className="input-panel__alpha-btn"
              style={{
                borderColor: active ? a.color : "#e2e8f0",
                background: active ? a.bg : "#f8fafc",
                color: a.color,
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <button
        data-action="save"
        onClick={onSave}
        className="input-panel__save-btn"
        style={{ background: inputShift && selectedDates.size > 0 ? "#ef4444" : "#cbd5e1" }}
      >
        保存（{selectedDates.size}件）
      </button>
    </div>
  );
}

function WorkTimeModal({ open, onClose }) {
  if (!open) return null;
  const rows = BASE_SHIFTS.filter(s => s.start);
  return (
    <div className="modal-overlay modal-overlay--center" onClick={onClose}>
      <div className="modal-sheet modal-sheet--dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-title">勤務時間表</div>
        <table className="work-table">
          <thead>
            <tr>
              <th>区分</th>
              <th>開始</th>
              <th>終了</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.key}>
                <td style={{ color: s.color, fontWeight: "700" }}>{s.label}</td>
                <td>{s.start}</td>
                <td>{s.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="modal-close-btn" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

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
    <div data-testid="shift-picker-overlay" className="modal-overlay" style={{ position: "fixed" }} onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">{day}日のシフトを選択</p>

        <div className="modal-section-label">シフト</div>
        <div className="picker-shift-grid">
          {BASE_SHIFTS.filter(s => s.key).map(s => (
            <button
              key={s.key}
              onClick={() => setSelectedBase(s.key)}
              className="picker-shift-btn"
              style={{
                borderColor: s.key === selectedBase ? s.color : "#e2e8f0",
                background: s.key === selectedBase ? s.bg : "#f8fafc",
                color: s.color,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="modal-section-label">オプション（複数選択可）</div>
        <div className="picker-alpha-row">
          {ALPHA_TYPES.map(a => {
            const active = selectedAlpha.includes(a.key);
            return (
              <button
                key={a.key}
                onClick={() => toggleAlpha(a.key)}
                className="picker-alpha-btn"
                style={{
                  borderColor: active ? a.color : "#e2e8f0",
                  background: active ? a.bg : "#f8fafc",
                  color: a.color,
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        <button onClick={handleSave} className="picker-save-btn">保存</button>
      </div>
    </div>
  );
}

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
      <div className="calendar-weekdays">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className="calendar-weekday"
            style={{ color: i === 0 ? "#ef4444" : i === 6 ? "#2563eb" : "#94a3b8" }}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const dow = (firstDay + d - 1) % 7;
          const entry = shifts[String(d)] || {};
          const shiftKey = entry.base ?? "";
          const alphaKeys = entry.alpha || [];
          const info = getBaseInfo(shiftKey);
          const isToday = isCurrentMonth && today.getDate() === d;
          const isSelected = inputMode && selectedDates.has(d);

          let cellClass = "calendar-cell";
          if (isSelected) cellClass += " calendar-cell--selected";
          else if (isToday) cellClass += " calendar-cell--today";

          return (
            <div
              key={d}
              onClick={() => onDayClick(d)}
              className={cellClass}
              style={{
                background: isSelected ? "#fff5f5" : shiftKey ? info.bg : "#f8fafc",
              }}
            >
              {isToday ? (
                <span className="calendar-cell__day calendar-cell__day--today">{d}</span>
              ) : (
                <span
                  className="calendar-cell__day"
                  style={{ color: dow === 0 ? "#ef4444" : dow === 6 ? "#2563eb" : "#475569" }}
                >
                  {d}
                </span>
              )}
              {shiftKey ? (
                <span style={{
                  fontSize: "10px", fontWeight: "700", color: info.color,
                  background: info.bg, border: `1px solid ${info.color}`,
                  borderRadius: "4px", padding: "1px 4px",
                }}>
                  {info.key}
                </span>
              ) : (
                <span className="calendar-cell__empty">－</span>
              )}
              {alphaKeys.length > 0 && (
                <div className="calendar-cell__alpha">
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

function ListView({ year, month, shifts, onDayClick }) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();

  return (
    <div className="list-view">
      {Array.from({ length: days }, (_, i) => i + 1).map(d => {
        const dow = (firstDay + d - 1) % 7;
        const entry = shifts[String(d)] || {};
        const shiftKey = entry.base ?? "";
        const alphaKeys = entry.alpha || [];
        const info = getBaseInfo(shiftKey);
        const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;
        return (
          <div
            key={d}
            onClick={() => onDayClick(d)}
            className={`list-item ${isToday ? "list-item--today" : ""}`}
            style={{ background: isToday ? "#eff6ff" : shiftKey ? info.bg : "#f8fafc" }}
          >
            <span
              className="list-item__day"
              style={{ color: dow === 0 ? "#ef4444" : dow === 6 ? "#2563eb" : "#1e293b" }}
            >
              {d}
            </span>
            <span
              className="list-item__dow"
              style={{ color: dow === 0 ? "#ef4444" : dow === 6 ? "#2563eb" : "#94a3b8" }}
            >
              {WEEKDAYS[dow]}
            </span>
            <ShiftBadge shiftKey={shiftKey} size="md" />
            <span className="list-item__label">{info.label}</span>
            {alphaKeys.length > 0 && (
              <div className="list-item__alpha">
                {alphaKeys.map(k => <AlphaBadge key={k} alphaKey={k} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryCards({ shifts }) {
  const baseCounts = {};
  BASE_SHIFTS.forEach(s => { if (s.key) baseCounts[s.key] = 0; });

  const alphaCounts = {};
  ALPHA_TYPES.forEach(a => { if (a.key) alphaCounts[a.key] = 0; });

  Object.values(shifts).forEach(entry => {
    const base = entry?.base;
    if (base && baseCounts[base] !== undefined) baseCounts[base]++;
    const alphas = entry?.alpha || [];
    alphas.forEach(a => { if (alphaCounts[a] !== undefined) alphaCounts[a]++; });
  });

  const baseItems = BASE_SHIFTS.filter(s => s.key && baseCounts[s.key] > 0);
  const alphaItems = ALPHA_TYPES.filter(a => a.key && alphaCounts[a.key] > 0);

  if (baseItems.length === 0 && alphaItems.length === 0) return null;

  return (
    <div className="summary-section">
      <div className="summary-grid">
        {baseItems.map(s => (
          <div
            key={s.key}
            className="summary-card"
            style={{ background: s.bg, borderColor: s.color }}
          >
            <div className="summary-card__count" style={{ color: s.color }}>{baseCounts[s.key]}</div>
            <div className="summary-card__label" style={{ color: s.color }}>{s.label}</div>
          </div>
        ))}
        {alphaItems.map(a => (
          <div
            key={a.key}
            className="summary-card"
            style={{ background: a.bg, borderColor: a.color }}
          >
            <div className="summary-card__count" style={{ color: a.color }}>{alphaCounts[a.key]}</div>
            <div className="summary-card__label" style={{ color: a.color }}>{a.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App({ session }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
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

  const toggleDateSelection = (day) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const toggleInputAlpha = (key) => {
    setInputAlpha(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleBulkSave = async () => {
    if (!inputShift || selectedDates.size === 0) return;
    const days = Array.from(selectedDates);
    const prevEntries = {};
    days.forEach(d => { prevEntries[String(d)] = shifts[String(d)]; });

    setShifts(prev => {
      const next = { ...prev };
      days.forEach(d => { next[String(d)] = { base: inputShift, alpha: inputAlpha }; });
      return next;
    });
    setSelectedDates(new Set());
    setInputShift("");
    setInputAlpha([]);
    setSaving(true);

    const results = await Promise.allSettled(days.map(d => saveShift(year, month, d, inputShift, inputAlpha)));
    setSaving(false);

    const failedDays = days.filter((_, i) => results[i].status === "rejected");
    if (failedDays.length > 0) {
      setError(`${failedDays.length}件の保存に失敗しました`);
      setShifts(prev => {
        const next = { ...prev };
        failedDays.forEach(d => { next[String(d)] = prevEntries[String(d)]; });
        return next;
      });
      results.forEach((r, i) => { if (r.status === "rejected") console.error(r.reason); });
    }
  };

  const handleDayClick = (day) => {
    if (inputMode) toggleDateSelection(day);
    else setPicker(day);
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

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
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: "20px" }}>
      {/* ヘッダー */}
      <header className="app-header">
        <div className="app-header__top">
          <div className="app-header__title-area">
            <span className="app-header__label">シフト管理</span>
            <span className="app-header__name">{UNAME}</span>
          </div>
          <div className="app-header__actions">
            {saving && <span className="saving-indicator">保存中...</span>}

            <button
              onClick={toggleInputMode}
              aria-label={inputMode ? "入力モード終了" : "入力モード開始"}
              className={`header-btn ${inputMode ? "header-btn--active" : ""}`}
            >
              ✏️ {inputMode ? "入力中" : "入力"}
            </button>

            <button onClick={() => setShowWorkTable(true)} className="header-btn header-btn--green">
              🕐 時間表
            </button>

            <button onClick={() => exportToICal(year, month, shifts, UNAME)} className="header-btn header-btn--teal">
              📅 カレンダー出力
            </button>

            <button
              onClick={async () => { await supabase.auth.signOut(); }}
              className="header-btn"
            >
              🚪 ログアウト
            </button>
          </div>
        </div>

        <div className="month-nav">
          <button onClick={prevMonth} className="month-nav__btn">‹</button>
          <span className="month-nav__label">{year}年{month}月</span>
          <button onClick={nextMonth} className="month-nav__btn">›</button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="error-banner">
            {error}
            <button className="error-banner__close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {loading && (
          <div className="loading-state">読み込み中...</div>
        )}

        {!loading && (
          <>
            {nextWork && (
              <div className="next-shift-card">
                <span className="next-shift-card__icon">📅</span>
                <div>
                  <div className="next-shift-card__label">次の出勤</div>
                  <div className="next-shift-card__content">
                    {month}月{nextWork.day}日
                    <ShiftBadge shiftKey={nextWork.base} size="md" />
                    {nextWork.alpha.map(k => <AlphaBadge key={k} alphaKey={k} />)}
                  </div>
                </div>
              </div>
            )}

            <div className="view-tabs">
              {[["calendar", "📅 カレンダー"], ["list", "📋 リスト"]].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`view-tab ${view === v ? "view-tab--active" : "view-tab--inactive"}`}
                >
                  {label}
                </button>
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

            <div className="card card--padded" style={{ marginBottom: "12px" }}>
              {view === "calendar"
                ? <CalendarView year={year} month={month} shifts={shifts} onDayClick={handleDayClick} inputMode={inputMode} selectedDates={selectedDates} />
                : <ListView year={year} month={month} shifts={shifts} onDayClick={handleDayClick} />
              }
            </div>

            <SummaryCards shifts={shifts} />

            {!inputMode && <p className="hint-text">日付をタップしてシフトを入力できます</p>}
          </>
        )}
      </div>

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
