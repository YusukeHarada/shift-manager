import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToICal } from "../ical";

// ダウンロード処理をモック化（実際のファイル生成はしない）
let capturedContent = "";
beforeEach(() => {
  capturedContent = "";
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();

  // Blob のコンテンツを捕捉する
  global.Blob = class {
    constructor(parts) {
      capturedContent = parts[0];
    }
  };

  // <a> タグのクリックをモック化
  const mockAnchor = { href: "", download: "", click: vi.fn() };
  vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);
});

function parseEvents(content) {
  return content
    .split("BEGIN:VEVENT")
    .slice(1)
    .map(chunk => chunk.split("END:VEVENT")[0]);
}

function activeEvents(content) {
  return parseEvents(content).filter(event => !event.includes("STATUS:CANCELLED"));
}

function cancelledEvents(content) {
  return parseEvents(content).filter(event => event.includes("STATUS:CANCELLED"));
}

function findEvent(content, day) {
  const uid = `UID:shift-${day}@shift-manager`;
  return parseEvents(content).find(event => event.includes(uid));
}

describe("exportToICal", () => {
  it("αオプションなし → ベースシフト単体のイベントが1つ出力される", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: [] },
    });

    const events = activeEvents(capturedContent);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("SUMMARY:早番");
    expect(events[0]).not.toContain("（");
  });

  it("αオプションあり → ベース単体イベントは出力されずα付きのみ出力される", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: ["残"] },
    });

    const events = activeEvents(capturedContent);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("SUMMARY:早番（残業）");
    // 「早番」単体（括弧なし）のSUMMARYは存在しない
    expect(capturedContent).not.toMatch(/^SUMMARY:早番$/m);
  });

  it("αオプションが複数 → 1つのイベントにまとめて出力される", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: ["残", "会"] },
    });

    const events = activeEvents(capturedContent);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("SUMMARY:早番（残業・会議）");
    expect(capturedContent).not.toMatch(/^SUMMARY:早番$/m);
  });

  it("複数日のデータを正しく出力できる", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: [] },
      "2": { base: "夜", alpha: ["残"] },
      "3": { base: "休", alpha: [] },
    });

    const events = activeEvents(capturedContent);
    expect(events).toHaveLength(3);
    expect(capturedContent).toContain("SUMMARY:早番");
    expect(capturedContent).toContain("SUMMARY:夜勤（残業）");
    expect(capturedContent).toContain("SUMMARY:休み");
  });

  it("baseが空の日は取り消しイベントとして出力される", () => {
    exportToICal(2025, 11, {
      "1": { base: "", alpha: [] },
      "2": { base: "早", alpha: [] },
    });

    expect(activeEvents(capturedContent)).toHaveLength(1);
    expect(findEvent(capturedContent, "20251101")).toContain("STATUS:CANCELLED");
    expect(findEvent(capturedContent, "20251102")).toContain("STATUS:CONFIRMED");
  });

  it("半休オプションがSUMMARYに反映される", () => {
    exportToICal(2025, 11, {
      "3": { base: "遅", alpha: ["前休"] },
      "4": { base: "日", alpha: ["後休"] },
    });

    expect(capturedContent).toContain("SUMMARY:遅番（AM休）");
    expect(capturedContent).toContain("SUMMARY:日勤（PM休）");
  });

  it("日付フォーマットが正しい（YYYYMMDD形式）", () => {
    exportToICal(2025, 11, {
      "5": { base: "遅", alpha: [] },
    });

    expect(capturedContent).toContain("DTSTART;VALUE=DATE:20251105");
  });

  it("ファイル名に年月が含まれる", () => {
    const mockAnchor = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);
    exportToICal(2025, 11, { "1": { base: "早", alpha: [] } });
    expect(mockAnchor.download).toBe("shift_2025_11.ics");
  });

  it("uname引数がDESCRIPTIONに反映される", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: [] } }, "山田 太郎");
    expect(capturedContent).toContain("DESCRIPTION:山田 太郎 - 早番");
  });

  it("uname未指定時はデフォルト「ユーザ」が使われる", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: [] } });
    expect(capturedContent).toContain("DESCRIPTION:ユーザ - 早番");
  });

  it("αオプションあり時もuname引数がDESCRIPTIONに反映される", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: ["残"] } }, "鈴木 花子");
    expect(capturedContent).toContain("DESCRIPTION:鈴木 花子 - 早番（残業）");
  });

  it("UIDは日付のみで決まり、αオプションを変えても変化しない", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: [] } });
    const before = findEvent(capturedContent, "20251101");

    exportToICal(2025, 11, { "1": { base: "遅", alpha: ["残", "会"] } });
    const after = findEvent(capturedContent, "20251101");

    expect(before).toContain("SUMMARY:早番");
    expect(after).toContain("SUMMARY:遅番（残業・会議）");
    // 同じ日には常に1イベントだけ（UIDが分岐しないので再インポートで上書きされる）
    const uids = parseEvents(capturedContent).map(event => event.match(/UID:(\S+)/)[1]);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("月内の全日がイベントとして出力される（未入力日は取り消し）", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: [] } });

    expect(parseEvents(capturedContent)).toHaveLength(30);
    expect(cancelledEvents(capturedContent)).toHaveLength(29);
  });

  it("2月の日数を正しく扱う（うるう年）", () => {
    exportToICal(2024, 2, { "1": { base: "早", alpha: [] } });
    expect(parseEvents(capturedContent)).toHaveLength(29);

    exportToICal(2025, 2, { "1": { base: "早", alpha: [] } });
    expect(parseEvents(capturedContent)).toHaveLength(28);
  });

  it("終日イベントのDTENDは翌日を指す", () => {
    exportToICal(2025, 11, { "30": { base: "早", alpha: [] } });

    const event = findEvent(capturedContent, "20251130");
    expect(event).toContain("DTSTART;VALUE=DATE:20251130");
    // 月末は翌月1日になる
    expect(event).toContain("DTEND;VALUE=DATE:20251201");
  });

  it("DTSTAMPとSEQUENCEが各イベントに含まれる", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: [] } });

    const event = findEvent(capturedContent, "20251101");
    expect(event).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(event).toMatch(/SEQUENCE:\d+/);
  });

  it("DESCRIPTIONの区切り文字がエスケープされる", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: [] } }, "山田, 太郎");
    expect(capturedContent).toContain("DESCRIPTION:山田\\, 太郎 - 早番");
  });

  it("同じラベルになるαオプションは重複表示しない", () => {
    exportToICal(2025, 11, { "1": { base: "早", alpha: ["残", "α"] } });
    expect(capturedContent).toContain("SUMMARY:早番（残業）");
  });
});
