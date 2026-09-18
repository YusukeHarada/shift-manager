import { describe, it, expect, vi } from "vitest";
import * as supabaseMock from "../__mocks__/supabase";
import * as icalMock from "../__mocks__/ical";

// 定数だけを見るテストだが、App.jsx の import が supabase.js の環境変数チェックを
// 走らせてしまうため、他のテストと同様にモックしておく
vi.mock("../supabase", () => supabaseMock);
vi.mock("../ical", () => icalMock);

import { BASE_SHIFTS, ALPHA_TYPES } from "../App";

// シフト色は薄い塗りに濃い文字を載せる設計のため、色を変えるたびに
// コントラスト不足を作り込みやすい。CLAUDE.md の規約をここで自動検証する。

function relativeLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const ALL = [...BASE_SHIFTS, ...ALPHA_TYPES];

describe("シフト色のコントラスト", () => {
  it.each(ALL.map(s => [s.label, s.color, s.bg]))(
    "%s はライトモードで 4.5:1 以上",
    (_label, color, bg) => {
      expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(ALL.map(s => [s.label, s.darkColor, s.darkBg]))(
    "%s はダークモードで 4.5:1 以上",
    (_label, darkColor, darkBg) => {
      expect(contrastRatio(darkColor, darkBg)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("シフト色の定義", () => {
  it("すべてのエントリが4色そろっている", () => {
    for (const s of ALL) {
      expect(s, s.label).toMatchObject({
        color: expect.stringMatching(/^#[0-9a-f]{6}$/),
        bg: expect.stringMatching(/^#[0-9a-f]{6}$/),
        darkColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
        darkBg: expect.stringMatching(/^#[0-9a-f]{6}$/),
      });
    }
  });

  it("配色が重複している種別が無い", () => {
    const byPalette = {};
    for (const s of ALL) {
      const palette = `${s.color}/${s.bg}`;
      (byPalette[palette] ||= []).push(s.label);
    }
    const shared = Object.values(byPalette).filter(labels => labels.length > 1);
    expect(shared).toEqual([]);
  });

  // 当直はαだけで扱う。ベースシフトに戻すと同じ勤務が2箇所から選べてしまう
  it("当直はαオプションにだけある", () => {
    expect(BASE_SHIFTS.map(s => s.label)).not.toContain("当直");
    expect(ALPHA_TYPES.map(a => a.label)).toContain("当直");
  });

  it("勤務時間を持つ種別に当直が含まれる（勤務時間表に出るため）", () => {
    const withHours = ALL.filter(s => s.start).map(s => s.label);
    expect(withHours).toContain("当直");
  });

  it("ベースシフトの塗りの明るさが揃っている（月のパターンが不揃いに見えないため）", () => {
    // 未入力はセルに出ないので対象外
    const fills = BASE_SHIFTS.filter(s => s.key).map(s => relativeLuminance(s.bg));
    expect(Math.max(...fills) / Math.min(...fills)).toBeLessThan(1.25);
  });
});
