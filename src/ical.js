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
  "α": "残業",  // 旧キーとの互換性維持
};

function formatDate(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}${m}${d}`;
}

function makeUid(year, month, day, suffix = "") {
  const base = `shift-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  return suffix ? `${base}-${suffix}@shift-manager` : `${base}@shift-manager`;
}

export function exportToICal(year, month, shifts, uname = "ユーザ") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShiftManager//JP",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const [day, entry] of Object.entries(shifts)) {
    // entry は { base: "日", alpha: ["残", "会"] } の形式
    const base = typeof entry === "object" ? entry.base : entry;
    const alphaKeys = typeof entry === "object" ? (entry.alpha || []) : [];

    if (!base) continue;

    const label = BASE_LABELS[base] || base;
    const dateStr = formatDate(year, month, Number(day));

    if (alphaKeys.length === 0) {
      // αオプションなし → ベースシフト単体のイベント
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${makeUid(year, month, day)}`);
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
      lines.push(`DTEND;VALUE=DATE:${dateStr}`);
      lines.push(`SUMMARY:${label}`);
      lines.push(`DESCRIPTION:${uname} - ${label}`);
      lines.push("END:VEVENT");
    } else {
      // αオプションあり → ベース単体は出さず「早番（残業）」形式のみ出力
      for (const alphaKey of alphaKeys) {
        const alphaLabel = ALPHA_LABELS[alphaKey] || alphaKey;
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${makeUid(year, month, day, alphaKey)}`);
        lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
        lines.push(`DTEND;VALUE=DATE:${dateStr}`);
        lines.push(`SUMMARY:${label}（${alphaLabel}）`);
        lines.push(`DESCRIPTION:${uname} - ${label}（${alphaLabel}）`);
        lines.push("END:VEVENT");
      }
    }
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
