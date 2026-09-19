// シフトデータの集計と疲労度の算出。UI を持たない純粋関数だけを置く

import { BASE_SHIFTS, ALPHA_TYPES } from "./shifts";

// 疲労度の重み。夜勤・当直の長時間拘束を重く、休みを回復として引く。
// 日勤帯は始業が早いほど楽という利用者の実感に合わせ、始業時刻の順に並べている
// （遅番 10:15 → 日勤 8:45 → 早番 7:30 → 早番1 7:00）
export const FATIGUE_LOAD = {
  "夜":  3.0,
  "遅":  1.3,
  "日":  1.2,
  "早":  1.0,
  "早1": 0.9,
  "明":  -0.5,
  "休":  -1.0,
};

export const FATIGUE_ALPHA = {
  "当":   2.5,
  "残":   0.5,
  "会":   0.3,
  "前休": -0.4,
  "後休": -0.4,
};

// 選択肢から外した種別で保存済みの日を無視しないよう、未知のキーは日勤相当に丸める
// （getBaseInfo が未知キーを表示上残すのと同じ方針）
const UNKNOWN_LOAD = 1.2;

const DECAY = 0.75;                 // 前日の疲労が翌日に残る割合
const STREAK_THRESHOLD = 5;         // これ以上の連勤で加点が始まる
const STREAK_PENALTY = 0.4;
const INTERVAL_THRESHOLD = 11 * 60; // 勤務間インターバル（労働基準法の努力義務）
const INTERVAL_PENALTY = 1.0;
// 夜勤と明け休みが続いたときの定常値（約9）を指数 100 の目安に置く。
// 日勤・早番・遅番・夜勤が一巡する通常のローテーションはこれで 40 未満に収まる
const FATIGUE_SCALE = 9;
// 減衰が 0.75 なので 14 日遡れば前月の影響は 2% 未満になる
const SEED_DAYS = 14;

export const FATIGUE_MID = 40;
export const FATIGUE_HIGH = 70;

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// "7:00" → 420、"翌9:30" → 2010（翌 = +24h）。表示用文字列しか持っていないため自前で解く
export function parseTime(str) {
  if (typeof str !== "string") return null;
  const isNextDay = str.startsWith("翌");
  const matched = (isNextDay ? str.slice(1) : str).match(/^(\d{1,2}):(\d{2})$/);
  if (!matched) return null;
  const minutes = Number(matched[1]) * 60 + Number(matched[2]);
  return isNextDay ? minutes + 1440 : minutes;
}

function buildTimeTable(list) {
  const table = {};
  list.forEach(s => {
    const start = parseTime(s.start);
    const end = parseTime(s.end);
    if (start !== null && end !== null) table[s.key] = { start, end };
  });
  return table;
}

const BASE_TIMES = buildTimeTable(BASE_SHIFTS);
const ALPHA_TIMES = buildTimeTable(ALPHA_TYPES);

function getSegments(entry) {
  const base = entry?.base ?? "";
  const alpha = entry?.alpha || [];
  const segments = [];
  if (BASE_TIMES[base]) segments.push({ ...BASE_TIMES[base] });
  alpha.forEach(key => { if (ALPHA_TIMES[key]) segments.push({ ...ALPHA_TIMES[key] }); });
  return segments;
}

// 日勤に当直が付くと 17:30〜19:00 が空く。重なりと連続だけを繋いで実拘束を出す
function mergeSegments(segments) {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged = [];
  sorted.forEach(seg => {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) last.end = Math.max(last.end, seg.end);
    else merged.push({ ...seg });
  });
  return merged;
}

// その日の拘束の始まりと終わり。当直が付くと終業が翌朝まで延びる
export function getDayWindow(entry) {
  const segments = getSegments(entry);
  if (segments.length === 0) return null;
  return {
    start: Math.min(...segments.map(s => s.start)),
    end: Math.max(...segments.map(s => s.end)),
  };
}

// 拘束分数。休み・明け休み・未入力は時刻を持たないので 0
export function getDuration(entry) {
  return mergeSegments(getSegments(entry)).reduce((sum, s) => sum + (s.end - s.start), 0);
}

// 前日の終業から翌日の始業までの分数。どちらかが勤務でなければ判定しない
export function getRestInterval(prevEntry, nextEntry) {
  const prev = getDayWindow(prevEntry);
  const next = getDayWindow(nextEntry);
  if (!prev || !next) return null;
  return next.start + 1440 - prev.end;
}

// 明け休みは夜勤の続きなので勤務日には数えない
export function isWorkDay(base) {
  return Boolean(base) && base !== "休" && base !== "明";
}

export function getDayLoad(entry) {
  const base = entry?.base ?? "";
  if (!base) return 0;
  const known = FATIGUE_LOAD[base];
  let load = known === undefined ? UNKNOWN_LOAD : known;
  (entry?.alpha || []).forEach(key => { load += FATIGUE_ALPHA[key] || 0; });
  return load;
}

export function toFatigueIndex(value) {
  return Math.max(0, Math.min(100, Math.round((value / FATIGUE_SCALE) * 100)));
}

export function toFatigueLevel(index) {
  if (index >= FATIGUE_HIGH) return "high";
  if (index >= FATIGUE_MID) return "mid";
  return "low";
}

// 前月末から当月末までを1本の配列にする。月initial の連勤と疲労の持ち越しを正しく見るため
function buildTimeline(year, month, shifts, prevShifts) {
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevDays = daysInMonth(prevYear, prevMonth);
  const rows = [];
  for (let day = Math.max(1, prevDays - SEED_DAYS + 1); day <= prevDays; day++) {
    rows.push({ day, inMonth: false, entry: prevShifts[String(day)] || null });
  }
  const days = daysInMonth(year, month);
  for (let day = 1; day <= days; day++) {
    rows.push({ day, inMonth: true, entry: shifts[String(day)] || null });
  }
  return rows;
}

// 未入力の日は連勤を切る。データが無い日を勤務と見なすと連勤日数を過大に出してしまう
function findStreaks(rows) {
  const runs = [];
  let start = null;
  rows.forEach((row, i) => {
    if (isWorkDay(row.entry?.base ?? "")) {
      if (start === null) start = i;
      return;
    }
    if (start !== null) {
      runs.push({ from: start, to: i - 1 });
      start = null;
    }
  });
  if (start !== null) runs.push({ from: start, to: rows.length - 1 });
  return runs.map(run => ({
    length: run.to - run.from + 1,
    startRow: rows[run.from],
    endRow: rows[run.to],
    touchesMonth: rows.slice(run.from, run.to + 1).some(r => r.inMonth),
  }));
}

export function analyzeMonth(year, month, shifts, prevShifts = {}) {
  const rows = buildTimeline(year, month, shifts, prevShifts);

  const baseCounts = {};
  BASE_SHIFTS.forEach(s => { if (s.key) baseCounts[s.key] = 0; });
  const alphaCounts = {};
  ALPHA_TYPES.forEach(a => { alphaCounts[a.key] = 0; });

  // 曜日 × ベースシフトの回数。曜日は日曜始まりの 0〜6
  const weekday = Array.from({ length: 7 }, () => ({ total: 0, work: 0, counts: {} }));

  const streaks = findStreaks(rows);

  const fatigue = [];
  const warnings = [];
  let accumulated = 0;
  let running = 0;
  let totalMinutes = 0;
  let nightMinutes = 0;
  let workDays = 0;
  let offDays = 0;
  let filledDays = 0;
  let shortestInterval = null;

  rows.forEach((row, i) => {
    const base = row.entry?.base ?? "";
    const alpha = row.entry?.alpha || [];
    const work = isWorkDay(base);
    running = work ? running + 1 : 0;

    let load = getDayLoad(row.entry);
    // 連勤が続くほど回復が追いつかなくなる
    if (running >= STREAK_THRESHOLD) load += STREAK_PENALTY;

    const interval = i > 0 ? getRestInterval(rows[i - 1].entry, row.entry) : null;
    if (interval !== null && interval < INTERVAL_THRESHOLD) load += INTERVAL_PENALTY;

    accumulated = Math.max(0, accumulated * DECAY + load);

    if (!row.inMonth) return;

    const index = toFatigueIndex(accumulated);
    fatigue.push({ day: row.day, index, level: toFatigueLevel(index), streak: running });

    if (interval !== null && (shortestInterval === null || interval < shortestInterval)) {
      shortestInterval = interval;
    }
    if (interval !== null && interval < INTERVAL_THRESHOLD) {
      warnings.push({ type: "interval", day: row.day, minutes: interval });
    }

    if (base) {
      filledDays++;
      if (baseCounts[base] !== undefined) baseCounts[base]++;
    }
    alpha.forEach(key => { if (alphaCounts[key] !== undefined) alphaCounts[key]++; });

    if (work) workDays++;
    else if (base) offDays++;

    const minutes = getDuration(row.entry);
    totalMinutes += minutes;
    if (base === "夜") nightMinutes += minutes;

    const dow = new Date(year, month - 1, row.day).getDay();
    weekday[dow].total++;
    if (work) weekday[dow].work++;
    if (base) weekday[dow].counts[base] = (weekday[dow].counts[base] || 0) + 1;
  });

  streaks
    .filter(streak => streak.touchesMonth && streak.length >= STREAK_THRESHOLD)
    .forEach(streak => {
      warnings.push({
        type: "streak",
        day: streak.endRow.day,
        startDay: streak.startRow.day,
        length: streak.length,
        fromPrevMonth: !streak.startRow.inMonth,
      });
    });

  warnings.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));

  const monthStreaks = streaks.filter(s => s.touchesMonth);
  const maxStreak = monthStreaks.reduce((max, s) => Math.max(max, s.length), 0);

  const peak = fatigue.reduce((max, f) => Math.max(max, f.index), 0);
  const average = fatigue.length > 0
    ? Math.round(fatigue.reduce((sum, f) => sum + f.index, 0) / fatigue.length)
    : 0;

  return {
    baseCounts,
    alphaCounts,
    filledDays,
    workDays,
    offDays,
    hours: {
      totalMinutes,
      nightMinutes,
      averageMinutes: workDays > 0 ? Math.round(totalMinutes / workDays) : 0,
    },
    weekday,
    streaks: { max: maxStreak, shortestInterval },
    fatigue,
    summary: { peak, average },
    warnings,
  };
}

export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}
