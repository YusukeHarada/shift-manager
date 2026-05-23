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

describe("exportToICal", () => {
  it("αオプションなし → ベースシフト単体のイベントが1つ出力される", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: [] },
    });

    expect(capturedContent).toContain("SUMMARY:早番");
    expect(capturedContent).not.toContain("（");
    // VEVENTのブロックが1つだけ
    const count = (capturedContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(1);
  });

  it("αオプションあり → ベース単体イベントは出力されずα付きのみ出力される", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: ["残"] },
    });

    expect(capturedContent).toContain("SUMMARY:早番（残業）");
    // 「早番」単体（括弧なし）のSUMMARYは存在しない
    expect(capturedContent).not.toMatch(/^SUMMARY:早番$/m);
    const count = (capturedContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(1);
  });

  it("αオプションが複数 → α付きイベントがα数分出力される", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: ["残", "会"] },
    });

    expect(capturedContent).toContain("SUMMARY:早番（残業,会議）");
    expect(capturedContent).not.toMatch(/^SUMMARY:早番$/m);
    const count = (capturedContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(1);
  });

  it("複数日のデータを正しく出力できる", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: [] },
      "2": { base: "夜", alpha: ["残"] },
      "3": { base: "休", alpha: [] },
    });

    expect(capturedContent).toContain("SUMMARY:早番");
    expect(capturedContent).toContain("SUMMARY:夜勤（残業）");
    expect(capturedContent).toContain("SUMMARY:休み");
    const count = (capturedContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(3);
  });

  it("baseが空の日はイベントに含まれない", () => {
    exportToICal(2025, 11, {
      "1": { base: "", alpha: [] },
      "2": { base: "早", alpha: [] },
    });

    const count = (capturedContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(1);
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
});
