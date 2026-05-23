import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToICal } from "../ical";

let capturedContent = "";

beforeEach(() => {
  capturedContent = "";

  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();

  global.Blob = class {
    constructor(parts) {
      capturedContent = parts[0];
    }
  };

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

    const count = (capturedContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(1);
  });

  it("空データではVEVENTを出力しない", () => {
    exportToICal(2025, 11, {});

    expect(capturedContent).not.toContain("BEGIN:VEVENT");
  });

  it("baseが空の日はイベントに含まれない", () => {
    exportToICal(2025, 11, {
      "1": { base: "", alpha: [] },
      "2": { base: "早", alpha: [] },
    });

    const count = (capturedContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(1);
  });

  it("日本語タイトルを出力できる", () => {
    exportToICal(2025, 11, {
      "1": { base: "夜", alpha: [] },
    });

    expect(capturedContent).toContain("SUMMARY:夜勤");
  });

  it("UIDが重複しない", () => {
    exportToICal(2025, 11, {
      "1": { base: "早", alpha: [] },
      "2": { base: "夜", alpha: [] },
    });

    const uidLines = capturedContent
      .split("\n")
      .filter((line) => line.startsWith("UID:"));

    expect(uidLines.length).toBe(new Set(uidLines).size);
  });

  it("日付フォーマットが正しい（YYYYMMDD形式）", () => {
    exportToICal(2025, 11, {
      "5": { base: "遅", alpha: [] },
    });

    expect(capturedContent).toContain("DTSTART;VALUE=DATE:20251105");
  });
});
