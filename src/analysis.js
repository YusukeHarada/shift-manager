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

// 当直は泊まりだが業務は軽く仮眠も取れるため、夜勤とは別物として軽く見る
export const FATIGUE_ALPHA = {
  "当":   1.0,
  "残":   0.5,
  "会":   0.3,
  "前休": -0.4,
  "後休": -0.4,
};

// 選択肢から外した種別で保存済みの日を無視しないよう、未知のキーは日勤相当に丸める
// （getBaseInfo が未知キーを表示上残すのと同じ方針）
const UNKNOWN_LOAD = 1.2;

// 半休の日の勤務時間。AM休は終業に寄せ、PM休は始業に寄せる
const HALF_DAY_MINUTES = 4 * 60;

const DECAY = 0.75;                 // 前日の疲労が翌日に残る割合
const STREAK_THRESHOLD = 5;         // これ以上の連勤で加点が始まる
const STREAK_PENALTY = 0.4;
const INTERVAL_THRESHOLD = 11 * 60; // 勤務間インターバル（労働基準法の努力義務）
const INTERVAL_PENALTY = 1.0;
// 当直明けにそのまま勤務が入る並び。インターバル違反より軽く見る（仮眠できるため）
const ON_CALL_GAP_PENALTY = 0.5;
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

// 時刻を持つα（現状は当直だけ）。夜をまたぐ断続的な拘束なので通常の勤務と分けて扱う
function getOnCallSegments(entry) {
  return (entry?.alpha || [])
    .filter(key => ALPHA_TIMES[key])
    .map(key => ({ ...ALPHA_TIMES[key] }));
}

// 半休はどちらの半分を休むかで時刻の寄せ方が変わるため、キーを直接見るしかない。
// ALPHA_TYPES の group: "half" だけでは前後が決まらない
function getShiftSegments(entry) {
  const times = BASE_TIMES[entry?.base ?? ""];
  if (!times) return [];
  const alpha = entry?.alpha || [];
  if (alpha.includes("前休")) return [{ start: times.end - HALF_DAY_MINUTES, end: times.end }];
  if (alpha.includes("後休")) return [{ start: times.start, end: times.start + HALF_DAY_MINUTES }];
  return [{ ...times }];
}

function getSegments(entry) {
  return [...getShiftSegments(entry), ...getOnCallSegments(entry)];
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

function toWindow(segments) {
  if (segments.length === 0) return null;
  return {
    start: Math.min(...segments.map(s => s.start)),
    end: Math.max(...segments.map(s => s.end)),
  };
}

// その日の拘束の始まりと終わり。当直が付くと終業が翌朝まで延びる
export function getDayWindow(entry) {
  return toWindow(getSegments(entry));
}

function sumSegments(segments) {
  return mergeSegments(segments).reduce((sum, s) => sum + (s.end - s.start), 0);
}

// 拘束分数。休み・明け休み・未入力は時刻を持たないので 0
export function getDuration(entry) {
  return sumSegments(getSegments(entry));
}

// そのうち当直のぶん。総拘束の内訳として別に出す
export function getOnCallDuration(entry) {
  return sumSegments(getOnCallSegments(entry));
}

// 前日の終業から翌日の始業までの分数。どちらかが勤務でなければ判定しない。
// 11時間ルールの判定なので当直の時間帯は含めない（仮眠を取れる断続的労働で、
// 通常のシフトと同じ拘束ではないため）。当直明けは getOnCallGap で別に見る
export function getRestInterval(prevEntry, nextEntry) {
  const prev = toWindow(getShiftSegments(prevEntry));
  const next = toWindow(getShiftSegments(nextEntry));
  if (!prev || !next) return null;
  return next.start + 1440 - prev.end;
}

// 当直は翌朝まで続くので、翌日にそのまま勤務が入ると休みらしい休みがない。
// 当直終了から翌日の始業までの分数を返す（翌日が休みなら null）
export function getOnCallGap(prevEntry, nextEntry) {
  const onCall = toWindow(getOnCallSegments(prevEntry));
  const next = toWindow(getShiftSegments(nextEntry));
  if (!onCall || !next) return null;
  return next.start + 1440 - onCall.end;
}

// 明け休みは夜勤の続きなので勤務日には数えない。
// ただし当直のように時刻を持つαが付いていれば、休みの日でも実際に働いている
export function isWorkDay(base, alpha = []) {
  if (alpha.some(key => ALPHA_TIMES[key])) return true;
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

// 前月末から当月末までを1本の配列にする。月初の連勤と疲労の持ち越しを正しく見るため
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
    if (isWorkDay(row.entry?.base ?? "", row.entry?.alpha || [])) {
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
  let onCallMinutes = 0;
  let workDays = 0;
  let offDays = 0;
  let filledDays = 0;
  let shortestInterval = null;

  rows.forEach((row, i) => {
    const base = row.entry?.base ?? "";
    const alpha = row.entry?.alpha || [];
    const work = isWorkDay(base, alpha);
    running = work ? running + 1 : 0;

    let load = getDayLoad(row.entry);
    // 連勤が続くほど回復が追いつかなくなる
    if (running >= STREAK_THRESHOLD) load += STREAK_PENALTY;

    const prevEntry = i > 0 ? rows[i - 1].entry : null;
    const interval = getRestInterval(prevEntry, row.entry);
    if (interval !== null && interval < INTERVAL_THRESHOLD) load += INTERVAL_PENALTY;

    // 当直明けにそのまま勤務が入る並び。11時間ルールとは別枠で、加点も軽くする
    const onCallGap = getOnCallGap(prevEntry, row.entry);
    if (onCallGap !== null) load += ON_CALL_GAP_PENALTY;

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
    if (onCallGap !== null) {
      warnings.push({ type: "oncall", day: row.day, minutes: onCallGap });
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
    onCallMinutes += getOnCallDuration(row.entry);
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
      onCallMinutes,
      averageMinutes: workDays > 0 ? Math.round(totalMinutes / workDays) : 0,
    },
    weekday,
    streaks: { max: maxStreak, shortestInterval },
    fatigue,
    summary: { peak, average },
    warnings,
  };
}

// 今日の値と、この先どこまで上がるかを取り出す。先のシフトは入力済みなので
// 「いつピークが来るか」が事前に分かる。analyzeMonth は今日を知らないので別関数にする
export function getFatigueOutlook(fatigue, todayDay) {
  const today = fatigue.find(f => f.day === todayDay);
  if (!today) return null;

  const ahead = fatigue.filter(f => f.day > todayDay);
  // 同じ値なら早いほうを返す（先に身構えられるため）
  const peak = ahead.reduce((max, f) => (max === null || f.index > max.index ? f : max), null);
  const reachesHigh = ahead.find(f => f.level === "high") || null;

  return { today, peak, reachesHigh };
}

export function formatMinutes(minutes) {
  // 夜勤（翌9:30終業）の翌日に日勤が入ると前後が重なって負になる。0 に丸めて表示を壊さない
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}
