// iCal（.ics）形式でシフトデータをエクスポートする

const BASE_LABELS = {
  "日":  "日勤",
  "早1": "早番1",
  "早":  "早番",
  "遅":  "遅番",
  "夜":  "夜勤",
  "明":  "明け休み",
  "当":  "当直",
  "休":  "休み",
};

const ALPHA_LABELS = {
  "残": "残業",
  "会": "会議",
  "当": "当直",
  "前休": "AM休",
  "後休": "PM休",
  "α": "残業",  // 旧キーとの互換性維持
};

function formatDate(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}${m}${d}`;
}

// 終日イベントの DTEND は排他的なので、翌日（月末なら翌月1日）を指す
function formatNextDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function formatTimestamp(date) {
  const pad = n => String(n).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

// 同じ日付なら常に同じ UID になるため、再インポート時に既存予定が上書きされる
function makeUid(year, month, day) {
  return `shift-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}@shift-manager`;
}

function escapeText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function buildSummary(base, alphaKeys) {
  const label = BASE_LABELS[base] || base;
  const alphaLabels = [...new Set(alphaKeys.map(key => ALPHA_LABELS[key] || key))];
  return alphaLabels.length > 0 ? `${label}（${alphaLabels.join("・")}）` : label;
}

export function exportToICal(year, month, shifts, uname = "ユーザ") {
  const dtstamp = formatTimestamp(new Date());
  // SEQUENCE は書き出しごとに増える必要がある（古い予定として無視されないようにするため）
  const sequence = Math.floor(Date.now() / 60000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShiftManager//JP",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    // entry は { base: "日", alpha: ["残", "会"] } の形式
    const entry = shifts[String(day)];
    const isObject = typeof entry === "object" && entry !== null;
    const base = isObject ? entry.base : entry;
    const alphaKeys = isObject ? (entry.alpha || []) : [];

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${makeUid(year, month, day)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`SEQUENCE:${sequence}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDate(year, month, day)}`);
    lines.push(`DTEND;VALUE=DATE:${formatNextDate(year, month, day)}`);

    if (base) {
      // αオプションは1日1イベントにまとめる（「早番（残業・会議）」形式）
      const summary = buildSummary(base, alphaKeys);
      lines.push(`SUMMARY:${escapeText(summary)}`);
      lines.push(`DESCRIPTION:${escapeText(`${uname} - ${summary}`)}`);
      lines.push("STATUS:CONFIRMED");
    } else {
      // シフトを消した日も出力する。取り消し扱いにすることで、
      // 以前の書き出しでカレンダーに登録された予定が消える
      lines.push("SUMMARY:（シフトなし）");
      lines.push("STATUS:CANCELLED");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const content = lines.join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `shift_${year}_${String(month).padStart(2, "0")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
