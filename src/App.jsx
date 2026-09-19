import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { supabase, fetchShifts, saveShift } from "./supabase";
import { exportToICal } from "./ical";
import { BASE_SHIFTS, ALPHA_TYPES } from "./shifts";
import { analyzeMonth, getFatigueOutlook, formatMinutes, FATIGUE_MID, FATIGUE_HIGH } from "./analysis";

// シフト種別の定義は analysis.js と共有するため shifts.js に置いている。
// 既存の import 元を変えずに済むよう、ここから再 export する
export { BASE_SHIFTS, ALPHA_TYPES };

// useMemo の依存が毎回変わらないよう、未取得の月は同じ参照を返す
const EMPTY_SHIFTS = {};

// 半休（AM休／PM休）は同時に成立しないため、同じ group のキーは1つだけ残す
function toggleAlphaKey(prev, key) {
  if (prev.includes(key)) return prev.filter(k => k !== key);
  const group = getAlphaInfo(key)?.group;
  const kept = group ? prev.filter(k => getAlphaInfo(k)?.group !== group) : prev;
  return [...kept, key];
}

// 明暗の出し分けは CSS 側の light-dark() が行うため、ここでは両方の値を渡すだけ
function colorVars(info) {
  return { "--sc": info.color, "--scd": info.darkColor, "--sbg": info.bg, "--sbgd": info.darkBg };
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getWeekdayLabels(weekStart) {
  const offset = weekStart === "sun" ? 0 : 1;
  return WEEKDAYS.map((_, i) => WEEKDAYS[(i + offset) % 7]);
}

// swatch は index.css の各テーマの --color-primary と揃える
const THEMES = [
  { key: "default", label: "デフォルト", swatch: "#2f3640" },
  { key: "ocean",    label: "オーシャン", swatch: "#1a5f9e" },
  { key: "forest",   label: "フォレスト", swatch: "#2a6e46" },
  { key: "sunset",   label: "サンセット", swatch: "#b9541f" },
  { key: "mono",     label: "モノクローム", swatch: "#3d3d3d" },
];

const MODES = [
  { key: "auto", label: "自動" },
  { key: "light", label: "ライト" },
  { key: "dark", label: "ダーク" },
];

const WEEK_START_KEY = "shift-manager:weekStart";
const THEME_KEY = "shift-manager:theme";
const MODE_KEY = "shift-manager:mode";

const UNAME = import.meta.env.VITE_USER_NAME || "ユーザ";

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconCalendar() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function IconList() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year, month, weekStart = "mon") {
  const dow = new Date(year, month - 1, 1).getDay();
  const offset = weekStart === "sun" ? 0 : 1;
  return (dow - offset + 7) % 7;
}

function getBaseInfo(key) {
  const found = BASE_SHIFTS.find(s => s.key === key);
  if (found) return found;
  // 選択肢から外した種別（当直など）で保存済みの日が空白に見えてしまわないよう、
  // 未知のキーは未入力の配色のままキーをそのまま表示する
  const unknown = BASE_SHIFTS[BASE_SHIFTS.length - 1];
  return key ? { ...unknown, key, label: key } : unknown;
}

function getAlphaInfo(key) {
  return ALPHA_TYPES.find(a => a.key === key);
}

// カレンダーやリストでは幅が無いので略称、余白のある場所では full で正式名称を出す
const ShiftBadge = memo(function ShiftBadge({ shiftKey, size = "sm", full = false }) {
  const info = getBaseInfo(shiftKey);
  return (
    <span
      className={`shift-badge shift-badge--${size}`}
      style={colorVars(info)}
    >
      {full ? info.label : (info.key || "－")}
    </span>
  );
});

const AlphaBadge = memo(function AlphaBadge({ alphaKey }) {
  const info = getAlphaInfo(alphaKey);
  if (!info) return null;
  return (
    <span
      className="alpha-badge"
      style={colorVars(info)}
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
          ? <span data-testid="selected-shift-label" className="input-panel__selected-shift" style={colorVars(shiftInfo)}>{shiftInfo.label}</span>
          : <span className="input-panel__placeholder">シフト未選択</span>
        }
        {inputAlpha.length > 0 && (
          <span data-testid="selected-alpha-label" style={{ display: "flex", gap: "4px" }}>
            {inputAlpha.map(k => {
              const a = ALPHA_TYPES.find(x => x.key === k);
              return a ? (
                <span key={k} className="input-panel__selected-alpha" style={colorVars(a)}>{a.label}</span>
              ) : null;
            })}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          日付：<span data-testid="selected-dates-count" className="input-panel__count">
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
            className={`input-panel__shift-btn${s.key === inputShift ? " input-panel__shift-btn--active" : ""}`}
            style={colorVars(s)}
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
              className={`input-panel__alpha-btn${active ? " input-panel__alpha-btn--active" : ""}`}
              style={colorVars(a)}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <button
        data-action="save"
        onClick={onSave}
        className={`input-panel__save-btn${inputShift && selectedDates.size > 0 ? " input-panel__save-btn--active" : ""}`}
      >
        保存（{selectedDates.size}件）
      </button>
    </div>
  );
}

function BottomNav({ inputMode, onToggleInput, onShowWorkTable, onExportICal, onShowSettings, onSignOut }) {
  return (
    <nav className="bottom-nav">
      <button onClick={onShowWorkTable} className="bottom-nav__btn">
        <span className="bottom-nav__icon"><IconClock /></span>
        <span className="bottom-nav__label">時間表</span>
      </button>
      <button
        onClick={onToggleInput}
        className={`bottom-nav__btn${inputMode ? " bottom-nav__btn--active" : ""}`}
        aria-label={inputMode ? "入力モード終了" : "入力モード開始"}
      >
        <span className="bottom-nav__icon"><IconEdit /></span>
        <span className="bottom-nav__label">{inputMode ? "入力中" : "入力"}</span>
      </button>
      <button onClick={onExportICal} className="bottom-nav__btn">
        <span className="bottom-nav__icon"><IconDownload /></span>
        <span className="bottom-nav__label">出力</span>
      </button>
      <button onClick={onShowSettings} className="bottom-nav__btn">
        <span className="bottom-nav__icon"><IconSettings /></span>
        <span className="bottom-nav__label">設定</span>
      </button>
      <button onClick={onSignOut} className="bottom-nav__btn">
        <span className="bottom-nav__icon"><IconLogOut /></span>
        <span className="bottom-nav__label">ログアウト</span>
      </button>
    </nav>
  );
}

function SettingsPanel({ open, weekStart, theme, mode, onChangeWeekStart, onChangeTheme, onChangeMode, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay modal-overlay--center" onClick={onClose}>
      <div className="modal-sheet modal-sheet--dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-title">設定</div>

        <div className="modal-section-label">表示モード</div>
        <div className="picker-shift-grid">
          {MODES.map(m => (
            <button
              key={m.key}
              data-mode-option={m.key}
              onClick={() => onChangeMode(m.key)}
              className={`picker-shift-btn picker-shift-btn--plain${mode === m.key ? " picker-shift-btn--active" : ""}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="modal-section-label">週の開始</div>
        <div className="picker-shift-grid">
          <button
            data-week-start="mon"
            onClick={() => onChangeWeekStart("mon")}
            className={`picker-shift-btn${weekStart === "mon" ? " picker-shift-btn--active" : ""}`}
          >
            月曜始まり
          </button>
          <button
            data-week-start="sun"
            onClick={() => onChangeWeekStart("sun")}
            className={`picker-shift-btn${weekStart === "sun" ? " picker-shift-btn--active" : ""}`}
          >
            日曜始まり
          </button>
        </div>

        <div className="modal-section-label">テーマ</div>
        <div className="theme-swatch-row">
          {THEMES.map(t => (
            <button
              key={t.key}
              data-theme-option={t.key}
              onClick={() => onChangeTheme(t.key)}
              className={`theme-swatch-btn${theme === t.key ? " theme-swatch-btn--active" : ""}`}
              aria-label={t.label}
            >
              <span className="theme-swatch-btn__color" style={{ background: t.swatch }} />
              <span className="theme-swatch-btn__label">{t.label}</span>
            </button>
          ))}
        </div>

        <button className="modal-close-btn" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

function WorkTimeModal({ open, onClose }) {
  if (!open) return null;
  // 当直はαにしか無いので、αからも時刻を持つものを拾う
  const rows = [...BASE_SHIFTS, ...ALPHA_TYPES].filter(s => s.start);
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
                <td className="work-table__label" style={colorVars(s)}>{s.label}</td>
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
    setSelectedAlpha(prev => toggleAlphaKey(prev, key));
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
              className={`picker-shift-btn${s.key === selectedBase ? " picker-shift-btn--active" : ""}`}
              style={colorVars(s)}
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
                className={`picker-alpha-btn${active ? " picker-alpha-btn--active" : ""}`}
                style={colorVars(a)}
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

function CalendarView({ year, month, shifts, onDayClick, inputMode = false, selectedDates = new Set(), weekStart = "mon" }) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month, weekStart);
  const offset = weekStart === "sun" ? 0 : 1;
  const weekdayLabels = getWeekdayLabels(weekStart);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div>
      <div className="calendar-weekdays">
        {weekdayLabels.map((w, i) => {
          const realDow = (i + offset) % 7;
          return (
            <div
              key={`${w}-${i}`}
              className="calendar-weekday"
              style={{ color: realDow === 0 ? "var(--color-sunday)" : realDow === 6 ? "var(--color-saturday)" : "var(--color-text-muted)" }}
            >
              {w}
            </div>
          );
        })}
      </div>
      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const dow = (firstDay + d - 1 + offset) % 7;
          const entry = shifts[String(d)] || {};
          const shiftKey = entry.base ?? "";
          const alphaKeys = entry.alpha || [];
          const info = getBaseInfo(shiftKey);
          const isToday = isCurrentMonth && today.getDate() === d;
          const isSelected = inputMode && selectedDates.has(d);

          let cellClass = "calendar-cell";
          if (shiftKey) cellClass += " calendar-cell--filled";
          if (isSelected) cellClass += " calendar-cell--selected";
          else if (isToday) cellClass += " calendar-cell--today";

          return (
            <div
              key={d}
              onClick={() => onDayClick(d)}
              className={cellClass}
              style={shiftKey ? colorVars(info) : undefined}
            >
              {isToday ? (
                <span className="calendar-cell__day calendar-cell__day--today">{d}</span>
              ) : (
                <span
                  className="calendar-cell__day"
                  style={{ color: dow === 0 ? "var(--color-sunday)" : dow === 6 ? "var(--color-saturday)" : "var(--color-text-secondary)" }}
                >
                  {d}
                </span>
              )}
              {shiftKey ? (
                <span className="calendar-cell__shift" style={colorVars(info)}>
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

function CalendarSkeleton({ weekStart = "mon" }) {
  return (
    <>
      <p className="loading-state">読み込み中...</p>
      <div className="card card--padded">
        <div className="calendar-weekdays">
          {getWeekdayLabels(weekStart).map((w, i) => <div key={`${w}-${i}`} className="skeleton-weekday" />)}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: 35 }, (_, i) => <div key={i} className="skeleton-cell" />)}
        </div>
      </div>
    </>
  );
}

function ListView({ year, month, shifts, onDayClick, weekStart = "mon" }) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month, weekStart);
  const offset = weekStart === "sun" ? 0 : 1;
  const today = new Date();

  return (
    <div className="list-view">
      {Array.from({ length: days }, (_, i) => i + 1).map(d => {
        const dow = (firstDay + d - 1 + offset) % 7;
        const entry = shifts[String(d)] || {};
        const shiftKey = entry.base ?? "";
        const alphaKeys = entry.alpha || [];
        const info = getBaseInfo(shiftKey);
        const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;
        const itemClass = `list-item${shiftKey ? " list-item--filled" : ""}${isToday ? " list-item--today" : ""}`;
        return (
          <div
            key={d}
            onClick={() => onDayClick(d)}
            className={itemClass}
            style={shiftKey ? colorVars(info) : undefined}
          >
            <span
              className="list-item__day"
              style={{ color: dow === 0 ? "var(--color-sunday)" : dow === 6 ? "var(--color-saturday)" : "var(--color-text)" }}
            >
              {d}
            </span>
            <span
              className="list-item__dow"
              style={{ color: dow === 0 ? "var(--color-sunday)" : dow === 6 ? "var(--color-saturday)" : "var(--color-text-muted)" }}
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

  // バーはベースシフトのみで構成する。αは1日に複数付くため合計が日数と合わない
  const baseTotal = baseItems.reduce((sum, s) => sum + baseCounts[s.key], 0);
  const chips = [
    ...baseItems.map(s => ({ key: `b${s.key}`, info: s, count: baseCounts[s.key] })),
    ...alphaItems.map(a => ({ key: `a${a.key}`, info: a, count: alphaCounts[a.key] })),
  ];

  return (
    <div className="summary-section">
      <div className="summary-bar" role="presentation">
        {baseItems.map(s => (
          <div
            key={s.key}
            className="summary-bar__seg"
            style={{ ...colorVars(s), width: `${(baseCounts[s.key] / baseTotal) * 100}%` }}
          />
        ))}
      </div>
      <div className="summary-chips">
        {chips.map(c => (
          <span key={c.key} className="summary-chip" style={colorVars(c.info)}>
            <span className="summary-chip__dot" />
            {c.info.label}
            <span className="summary-chip__count">{c.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const FATIGUE_LEVEL_LABELS = { low: "ゆとり", mid: "注意", high: "要休養" };

// 今日の値を大きく出す。グラフの中から今日の棒を探さなくても分かるようにするため。
// 先のシフトは入力済みなので、このあとどこまで上がるかも併せて出す
function FatigueNow({ outlook, month }) {
  const { today, peak, reachesHigh } = outlook;

  // peak が null なのは先の日が1日も無いときだけ。翌月は取得していないので
  // 月末は「下がる」とも言えない。何も言わないほうが正直
  let forecast = null;
  if (reachesHigh) {
    forecast = `このあと ${month}月${reachesHigh.day}日 に ${reachesHigh.index}（要休養）まで上がります`;
  } else if (peak && peak.index > today.index) {
    forecast = `このあと ${month}月${peak.day}日 に ${peak.index} まで上がります`;
  } else if (peak) {
    forecast = "このあとは下がっていきます";
  }

  return (
    <div className={`fatigue-now fatigue-now--${today.level}`}>
      <div className="fatigue-now__head">
        <span className="fatigue-now__value">{today.index}</span>
        <span className="fatigue-now__level">{FATIGUE_LEVEL_LABELS[today.level]}</span>
      </div>
      {forecast && <p className="fatigue-now__forecast">{forecast}</p>}
    </div>
  );
}

// 疲労度は日ごとの棒で見せる。しきい値超えだけ色を変え、
// 残りは無彩色の濃淡にする（シフト色の色相はすべて埋まっているため）
function FatigueChart({ fatigue, summary }) {
  return (
    <div className="fatigue-chart">
      <div className="fatigue-chart__head">
        <span className="fatigue-chart__stat">
          平均<strong>{summary.average}</strong>
        </span>
        <span className="fatigue-chart__stat">
          ピーク<strong>{summary.peak}</strong>
        </span>
      </div>
      <div className="fatigue-chart__plot">
        {fatigue.map(f => (
          <div key={f.day} className="fatigue-chart__slot" title={`${f.day}日：${f.index}`}>
            <div
              className={`fatigue-chart__bar fatigue-chart__bar--${f.level}`}
              style={{ height: `${Math.max(f.index, 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="fatigue-chart__axis">
        {[1, 10, 20, fatigue.length].map(d => (
          <span key={d} className="fatigue-chart__tick">{d}</span>
        ))}
      </div>
      <div className="fatigue-chart__legend">
        <span className="fatigue-chart__key fatigue-chart__key--low" />ゆとり
        <span className="fatigue-chart__key fatigue-chart__key--mid" />注意（{FATIGUE_MID}〜）
        <span className="fatigue-chart__key fatigue-chart__key--high" />要休養（{FATIGUE_HIGH}〜）
      </div>
    </div>
  );
}

function WarningList({ warnings }) {
  if (warnings.length === 0) {
    return <p className="analysis-empty">連勤・勤務間インターバルの警告はありません</p>;
  }
  return (
    <ul className="warning-list">
      {warnings.map((w, i) => (
        <li
          key={`${w.type}-${w.day}-${i}`}
          className={`warning-item${w.type === "oncall" ? " warning-item--soft" : ""}`}
        >
          <span className="warning-item__day">{w.day}日</span>
          {w.type === "streak" && (
            <span>{w.startDay}日から{w.length}連勤{w.fromPrevMonth ? "（前月から継続）" : ""}</span>
          )}
          {w.type === "interval" && (
            <span>前日から{formatMinutes(w.minutes)}しか空いていません</span>
          )}
          {w.type === "oncall" && (
            <span>当直明けの勤務（空き{formatMinutes(w.minutes)}）</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// 「10時間48分」のような時刻表記は数字だけの値より長いので compact で字を落とす
function StatTile({ label, value, unit, compact = false }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile__label">{label}</div>
      <div className={`stat-tile__value${compact ? " stat-tile__value--compact" : ""}`}>
        {value}{unit && <span className="stat-tile__unit">{unit}</span>}
      </div>
    </div>
  );
}

function StatGrid({ result }) {
  const { hours, streaks } = result;
  return (
    <div className="stat-grid">
      <StatTile label="稼働日数" value={result.workDays} unit="日" />
      <StatTile label="休日数" value={result.offDays} unit="日" />
      <StatTile label="総拘束時間" value={Math.round(hours.totalMinutes / 60)} unit="時間" />
      <StatTile label="うち夜勤" value={Math.round(hours.nightMinutes / 60)} unit="時間" />
      {hours.onCallMinutes > 0 && (
        <StatTile label="うち当直" value={Math.round(hours.onCallMinutes / 60)} unit="時間" />
      )}
      <StatTile label="1日平均" value={formatMinutes(hours.averageMinutes)} compact />
      <StatTile label="最大連勤" value={streaks.max} unit="日" />
      <StatTile
        label="最短の空き"
        value={streaks.shortestInterval === null ? "—" : formatMinutes(streaks.shortestInterval)}
        compact
      />
    </div>
  );
}

// 種別ごとの回数と割合。バーは各種別の色で塗り、割合をそのまま幅にする
function ShiftCountTable({ counts, types, total }) {
  const items = types.filter(t => t.key && counts[t.key] > 0);
  if (items.length === 0) return null;
  return (
    <div className="count-list">
      {items.map(t => {
        const count = counts[t.key];
        const ratio = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={t.key} className="count-row" style={colorVars(t)}>
            <span className="count-row__label">{t.label}</span>
            <span className="count-row__track">
              <span className="count-row__fill" style={{ width: `${ratio}%` }} />
            </span>
            <span className="count-row__count">{count}</span>
            <span className="count-row__ratio">{Math.round(ratio)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// 曜日ごとの偏りを見る。濃さは同じ行の最大回数を基準にする
function WeekdayHeatmap({ weekday, weekStart }) {
  const labels = getWeekdayLabels(weekStart);
  const offset = weekStart === "sun" ? 0 : 1;
  const rows = BASE_SHIFTS.filter(
    s => s.key && weekday.some(w => w.counts[s.key] > 0)
  );
  if (rows.length === 0) return null;

  return (
    <div className="heatmap">
      <div className="heatmap__row heatmap__row--head">
        <span className="heatmap__label" />
        {labels.map((w, i) => {
          const dow = (i + offset) % 7;
          return (
            <span
              key={`${w}-${i}`}
              className="heatmap__head"
              style={{ color: dow === 0 ? "var(--color-sunday)" : dow === 6 ? "var(--color-saturday)" : "var(--color-text-muted)" }}
            >
              {w}
            </span>
          );
        })}
      </div>
      {rows.map(s => {
        const max = Math.max(...weekday.map(w => w.counts[s.key] || 0));
        return (
          <div key={s.key} className="heatmap__row">
            <span className="heatmap__label" style={colorVars(s)}>{s.label}</span>
            {labels.map((w, i) => {
              const count = weekday[(i + offset) % 7].counts[s.key] || 0;
              return (
                <span
                  key={`${s.key}-${i}`}
                  className="heatmap__cell"
                  style={{ "--heat": max > 0 ? count / max : 0 }}
                >
                  {count > 0 ? count : ""}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function AnalysisSection({ title, note, children }) {
  return (
    <section className="analysis-section">
      <h2 className="analysis-section__title">
        {title}
        {note && <span className="analysis-section__note">{note}</span>}
      </h2>
      {children}
    </section>
  );
}

function AnalysisView({ year, month, shifts, prevShifts, weekStart, todayDay }) {
  const result = useMemo(
    () => analyzeMonth(year, month, shifts, prevShifts),
    [year, month, shifts, prevShifts]
  );

  if (result.filledDays === 0) {
    return <p className="analysis-empty">シフトを入力すると分析が表示されます</p>;
  }

  const alphaTotal = Object.values(result.alphaCounts).reduce((sum, n) => sum + n, 0);
  // 当月を見ているときだけ。todayDay は当月でなければ null
  const outlook = todayDay === null ? null : getFatigueOutlook(result.fatigue, todayDay);

  return (
    <div className="analysis-view">
      {outlook && (
        <AnalysisSection title="今の疲労度">
          <FatigueNow outlook={outlook} month={month} />
        </AnalysisSection>
      )}

      <AnalysisSection title="疲労度の推移" note="前月末からの蓄積を含む">
        <FatigueChart fatigue={result.fatigue} summary={result.summary} />
      </AnalysisSection>

      <AnalysisSection title="気をつけたい日">
        <WarningList warnings={result.warnings} />
      </AnalysisSection>

      <AnalysisSection title="今月の勤務">
        <StatGrid result={result} />
      </AnalysisSection>

      <AnalysisSection title="シフト種別の内訳">
        <ShiftCountTable counts={result.baseCounts} types={BASE_SHIFTS} total={result.filledDays} />
        {alphaTotal > 0 && (
          /* αは1日に複数付くので割合はα同士ではなく「入力済みの日のうち何%に付いたか」で出す */
          <ShiftCountTable counts={result.alphaCounts} types={ALPHA_TYPES} total={result.filledDays} />
        )}
      </AnalysisSection>

      <AnalysisSection title="曜日別の傾向">
        <WeekdayHeatmap weekday={result.weekday} weekStart={weekStart} />
      </AnalysisSection>
    </div>
  );
}

export default function App({ session: _session }) {
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
  const [direction, setDirection] = useState(1);
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [prevShiftsCache, setPrevShiftsCache] = useState({});
  const [weekStart, setWeekStart] = useState(() => localStorage.getItem(WEEK_START_KEY) || "mon");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "default");
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || "auto");

  useEffect(() => {
    localStorage.setItem(WEEK_START_KEY, weekStart);
  }, [weekStart]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 自動は data-mode を外す。CSS 側の color-scheme が OS の設定に従う
  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
    if (mode === "auto") document.documentElement.removeAttribute("data-mode");
    else document.documentElement.setAttribute("data-mode", mode);
  }, [mode]);

  const toastTimeoutRef = useRef(null);
  const touchStartXRef = useRef(null);
  const justSwipedRef = useRef(false);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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

  const prevKey = month === 1 ? `${year - 1}-12` : `${year}-${month - 1}`;
  const prevShifts = prevShiftsCache[prevKey] || EMPTY_SHIFTS;

  // 分析ビューは前月末の数日を疲労度の初期値と連勤判定に使う。
  // カレンダーとリストには不要なので、分析を開いたときだけ取りにいく。
  // 取得済みの月はキャッシュから引くので、月を行き来しても再取得しない
  useEffect(() => {
    if (view !== "analysis" || prevShiftsCache[prevKey]) return;
    const [prevYear, prevMonth] = prevKey.split("-").map(Number);
    let cancelled = false;
    fetchShifts(prevYear, prevMonth)
      // 前月が取れなくても当月の分析は出せる。空で埋めてエラーバナーは出さない
      .catch(() => ({}))
      .then(data => { if (!cancelled) setPrevShiftsCache(c => ({ ...c, [prevKey]: data })); });
    return () => { cancelled = true; };
  }, [view, prevKey, prevShiftsCache]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const handleShiftSelect = async (day, base, alpha) => {
    const prev = shifts[String(day)];
    setShifts(s => ({ ...s, [String(day)]: { base, alpha } }));
    setSaving(true);
    try {
      await saveShift(year, month, day, base, alpha);
      showToast("保存しました");
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
    setInputAlpha(prev => toggleAlphaKey(prev, key));
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
      results.forEach((r) => { if (r.status === "rejected") console.error(r.reason); });
    } else {
      showToast("保存しました");
    }
  };

  const handleDayClick = (day) => {
    if (justSwipedRef.current) { justSwipedRef.current = false; return; }
    if (inputMode) toggleDateSelection(day);
    else setPicker(day);
  };

  const prevMonth = () => {
    setDirection(-1);
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setDirection(1);
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) < 50) return;
    justSwipedRef.current = true;
    if (deltaX > 0) prevMonth();
    else nextMonth();
  };

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  let nextWork = null;
  if (isCurrentMonth) {
    const days = getDaysInMonth(year, month);
    for (let d = today.getDate(); d <= days; d++) {
      const entry = shifts[String(d)];
      const base = entry?.base;
      if (base && base !== "休") {
        const info = getBaseInfo(base);
        nextWork = {
          day: d,
          base,
          alpha: entry.alpha || [],
          dow: WEEKDAYS[new Date(year, month - 1, d).getDay()],
          time: info.start && info.end ? `${info.start} 〜 ${info.end}` : null,
        };
        break;
      }
    }
  }

  const pickerEntry = picker ? (shifts[String(picker)] || {}) : null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-bg)" }}>
      {/* ヘッダー：タイトル・月ナビを1行に集約してカレンダー表示領域を確保 */}
      <header className="app-header">
        <div className="app-header__row">
          <div className="app-header__title-area">
            <span className="app-header__label">シフト管理</span>
            <span className="app-header__name">{UNAME}</span>
          </div>
          <div className="month-nav">
            <button onClick={prevMonth} className="month-nav__btn">‹</button>
            <span className="month-nav__label">{year}年{month}月</span>
            <button onClick={nextMonth} className="month-nav__btn">›</button>
          </div>
          {saving && <span className="saving-indicator">保存中...</span>}
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <div className="error-banner__actions">
              <button className="error-banner__retry" onClick={loadShifts}>再読み込み</button>
              <button className="error-banner__close" onClick={() => setError(null)}>×</button>
            </div>
          </div>
        )}

        {loading && <CalendarSkeleton weekStart={weekStart} />}

        {!loading && (
          <>
            {nextWork && (
              <div className="next-shift-card">
                <div className="next-shift-card__label">次の出勤</div>
                <div className="next-shift-card__content">
                  <span className="next-shift-card__date">{month}月{nextWork.day}日</span>
                  <span className="next-shift-card__dow">（{nextWork.dow}）</span>
                  <ShiftBadge shiftKey={nextWork.base} size="md" full />
                  {nextWork.alpha.map(k => <AlphaBadge key={k} alphaKey={k} />)}
                </div>
                {nextWork.time && (
                  <div className="next-shift-card__time">
                    <IconClock />
                    {nextWork.time}
                  </div>
                )}
              </div>
            )}

            <div className="view-tabs">
              {[["calendar", "カレンダー", IconCalendar], ["list", "リスト", IconList], ["analysis", "分析", IconChart]].map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`view-tab ${view === v ? "view-tab--active" : "view-tab--inactive"}`}
                >
                  <Icon />
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

            <div
              className="card card--padded"
              style={{ marginBottom: "12px" }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div key={`${year}-${month}-${view}`} className={`month-transition${direction < 0 ? " month-transition--backward" : ""}`}>
                {view === "calendar" && (
                  <CalendarView year={year} month={month} shifts={shifts} onDayClick={handleDayClick} inputMode={inputMode} selectedDates={selectedDates} weekStart={weekStart} />
                )}
                {view === "list" && (
                  <ListView year={year} month={month} shifts={shifts} onDayClick={handleDayClick} weekStart={weekStart} />
                )}
                {view === "analysis" && (
                  <AnalysisView year={year} month={month} shifts={shifts} prevShifts={prevShifts} weekStart={weekStart} todayDay={isCurrentMonth ? today.getDate() : null} />
                )}
              </div>
            </div>

            {view !== "analysis" && <SummaryCards shifts={shifts} />}

            {view !== "analysis" && !inputMode && <p className="hint-text">日付をタップしてシフトを入力できます</p>}
          </>
        )}
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}

      <WorkTimeModal open={showWorkTable} onClose={() => setShowWorkTable(false)} />

      <SettingsPanel
        open={showSettings}
        weekStart={weekStart}
        theme={theme}
        mode={mode}
        onChangeWeekStart={setWeekStart}
        onChangeTheme={setTheme}
        onChangeMode={setMode}
        onClose={() => setShowSettings(false)}
      />

      {!inputMode && picker && (
        <ShiftPicker
          day={picker}
          currentBase={pickerEntry?.base ?? ""}
          currentAlpha={pickerEntry?.alpha ?? []}
          onSelect={(base, alpha) => handleShiftSelect(picker, base, alpha)}
          onClose={() => setPicker(null)}
        />
      )}

      <BottomNav
        inputMode={inputMode}
        onToggleInput={toggleInputMode}
        onShowWorkTable={() => setShowWorkTable(true)}
        onExportICal={() => exportToICal(year, month, shifts, UNAME)}
        onShowSettings={() => setShowSettings(true)}
        onSignOut={async () => { await supabase.auth.signOut(); }}
      />
    </div>
  );
}
