// iCal（.ics）形式でシフトデータをエクスポートする

const SHIFT_LABELS = {
  "早":  "早番",
  "早1": "早番1",
  "遅":  "遅番",
  "夜":  "夜勤",
  "明":  "明け休み",
  "当":  "当直",
  "休":  "休み",
  "α":   "残業",
  "会":  "会議",
};

// 日付を yyyyMMdd 形式に変換
function formatDate(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}${m}${d}`;
}

// ユニークIDを生成
function makeUid(year, month, day) {
  return `shift-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}@shift-manager`;
}

export function exportToICal(year, month, shifts) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShiftManager//JP",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const [day, shiftKey] of Object.entries(shifts)) {
    if (!shiftKey) continue;
    const label = SHIFT_LABELS[shiftKey] || shiftKey;
    const dateStr = formatDate(year, month, Number(day));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${makeUid(year, month, day)}`);
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    lines.push(`DTEND;VALUE=DATE:${dateStr}`);
    lines.push(`SUMMARY:${label}`);
    lines.push(`DESCRIPTION:原田 真依 - ${label}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const content = lines.join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // ダウンロードを実行
  const a = document.createElement("a");
  a.href = url;
  a.download = `shift_${year}_${String(month).padStart(2, "0")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
