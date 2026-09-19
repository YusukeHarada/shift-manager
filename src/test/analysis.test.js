import { describe, it, expect } from "vitest";
import {
  parseTime,
  getDuration,
  getDayWindow,
  getRestInterval,
  isWorkDay,
  getDayLoad,
  analyzeMonth,
  formatMinutes,
  FATIGUE_LOAD,
  FATIGUE_ALPHA,
} from "../analysis";

const entry = (base, alpha = []) => ({ base, alpha });

// 月の全日を同じシフトで埋める
function fillMonth(base, alpha = [], days = 30) {
  const shifts = {};
  for (let d = 1; d <= days; d++) shifts[String(d)] = entry(base, alpha);
  return shifts;
}

// パターンを1日目から順に並べる
function fromPattern(pattern) {
  const shifts = {};
  pattern.forEach((k, i) => {
    shifts[String(i + 1)] = Array.isArray(k) ? entry(k[0], k[1]) : entry(k);
  });
  return shifts;
}

describe("parseTime", () => {
  it("時刻を分に直す", () => {
    expect(parseTime("7:00")).toBe(420);
    expect(parseTime("8:45")).toBe(525);
    expect(parseTime("19:00")).toBe(1140);
  });

  it("翌日の時刻は24時間ぶん進める", () => {
    expect(parseTime("翌9:30")).toBe(2010);
    expect(parseTime("翌7:00")).toBe(1860);
  });

  it("時刻として読めない値は null", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("あさ")).toBeNull();
    expect(parseTime(undefined)).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
});

describe("getDuration", () => {
  it("日勤・早番・遅番はどれも8時間45分", () => {
    ["日", "早1", "早", "遅"].forEach(key => {
      expect(getDuration(entry(key))).toBe(525);
    });
  });

  it("夜勤は翌朝までの17時間", () => {
    expect(getDuration(entry("夜"))).toBe(1020);
  });

  it("休み・明け休み・未入力は時刻を持たないので0", () => {
    expect(getDuration(entry("休"))).toBe(0);
    expect(getDuration(entry("明"))).toBe(0);
    expect(getDuration(entry(""))).toBe(0);
    expect(getDuration(null)).toBe(0);
  });

  it("日勤に当直が付くと空き時間を除いた実拘束を足す", () => {
    // 日勤 8:45-17:30（525分）＋ 当直 19:00-翌7:00（720分）。間の1時間半は含めない
    expect(getDuration(entry("日", ["当"]))).toBe(525 + 720);
  });

  it("遅番と当直は連続するのでひと続きに数える", () => {
    // 遅番 10:15-19:00 と 当直 19:00-翌7:00 が接するので 10:15-翌7:00
    expect(getDuration(entry("遅", ["当"]))).toBe(1860 - 615);
  });

  it("時刻を持たないαは拘束時間に影響しない", () => {
    expect(getDuration(entry("日", ["残", "会"]))).toBe(525);
  });
});

describe("getDayWindow", () => {
  it("当直が付くと終業が翌朝まで延びる", () => {
    expect(getDayWindow(entry("日", ["当"]))).toEqual({ start: 525, end: 1860 });
  });

  it("勤務のない日は null", () => {
    expect(getDayWindow(entry("休"))).toBeNull();
    expect(getDayWindow(entry(""))).toBeNull();
  });
});

describe("getRestInterval", () => {
  it("当直明けに日勤が続くと極端に短くなる", () => {
    // 翌7:00 終業 → 8:45 始業
    expect(getRestInterval(entry("日", ["当"]), entry("日"))).toBe(105);
  });

  it("遅番から早番1はちょうど12時間", () => {
    expect(getRestInterval(entry("遅"), entry("早1"))).toBe(720);
  });

  it("どちらかが勤務でなければ判定しない", () => {
    expect(getRestInterval(entry("夜"), entry("明"))).toBeNull();
    expect(getRestInterval(entry("休"), entry("日"))).toBeNull();
    expect(getRestInterval(null, entry("日"))).toBeNull();
  });
});

describe("isWorkDay", () => {
  it("明け休みは夜勤の続きなので勤務日に数えない", () => {
    expect(isWorkDay("明")).toBe(false);
    expect(isWorkDay("休")).toBe(false);
    expect(isWorkDay("")).toBe(false);
    expect(isWorkDay("夜")).toBe(true);
    expect(isWorkDay("日")).toBe(true);
  });
});

describe("getDayLoad", () => {
  it("ベースシフトの重みをそのまま返す", () => {
    expect(getDayLoad(entry("夜"))).toBe(FATIGUE_LOAD["夜"]);
    expect(getDayLoad(entry("休"))).toBe(FATIGUE_LOAD["休"]);
  });

  it("αの重みを足す", () => {
    expect(getDayLoad(entry("日", ["当"]))).toBeCloseTo(FATIGUE_LOAD["日"] + FATIGUE_ALPHA["当"]);
    expect(getDayLoad(entry("日", ["残", "会"]))).toBeCloseTo(
      FATIGUE_LOAD["日"] + FATIGUE_ALPHA["残"] + FATIGUE_ALPHA["会"]
    );
  });

  it("半休は負荷を下げる", () => {
    expect(getDayLoad(entry("日", ["前休"]))).toBeLessThan(getDayLoad(entry("日")));
  });

  it("未入力は0", () => {
    expect(getDayLoad(entry(""))).toBe(0);
    expect(getDayLoad(null)).toBe(0);
  });

  it("未知のキーは日勤相当に丸める", () => {
    expect(getDayLoad(entry("当"))).toBe(FATIGUE_LOAD["日"]);
  });
});

describe("analyzeMonth - 集計", () => {
  it("種別ごとの回数を数える", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["日", "日", "夜", "明", "休"]), {});
    expect(r.baseCounts["日"]).toBe(2);
    expect(r.baseCounts["夜"]).toBe(1);
    expect(r.filledDays).toBe(5);
  });

  it("αの回数を数える", () => {
    const r = analyzeMonth(2025, 11, fromPattern([["日", ["残"]], ["日", ["残", "会"]]]), {});
    expect(r.alphaCounts["残"]).toBe(2);
    expect(r.alphaCounts["会"]).toBe(1);
  });

  it("明け休みは休日に数える", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["夜", "明", "休", "日"]), {});
    expect(r.workDays).toBe(2);
    expect(r.offDays).toBe(2);
  });

  it("拘束時間を合計する", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["日", "夜", "明"]), {});
    expect(r.hours.totalMinutes).toBe(525 + 1020);
    expect(r.hours.nightMinutes).toBe(1020);
    // 稼働日は日勤と夜勤の2日
    expect(r.hours.averageMinutes).toBe(Math.round((525 + 1020) / 2));
  });

  it("曜日ごとの回数を振り分ける", () => {
    // 2025年11月1日は土曜日
    const r = analyzeMonth(2025, 11, fromPattern(["日"]), {});
    expect(r.weekday[6].counts["日"]).toBe(1);
    expect(r.weekday[6].work).toBe(1);
    expect(r.weekday[0].work).toBe(0);
  });

  it("最短の勤務間インターバルを出す", () => {
    const r = analyzeMonth(2025, 11, fromPattern([["日", ["当"]], "日", "休", "遅", "早1"]), {});
    expect(r.streaks.shortestInterval).toBe(105);
  });
});

describe("analyzeMonth - 疲労度", () => {
  it("休みが続けば0で下げ止まる", () => {
    const r = analyzeMonth(2025, 11, fillMonth("休"), {});
    expect(r.fatigue.every(f => f.index === 0)).toBe(true);
    expect(r.summary.peak).toBe(0);
  });

  it("未入力の月は分析対象が空になる", () => {
    const r = analyzeMonth(2025, 11, {}, {});
    expect(r.filledDays).toBe(0);
    expect(r.workDays).toBe(0);
    expect(r.summary.peak).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it("勤務が続くと疲労度が積み上がる", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["日", "日", "日", "日"]), {});
    const head = r.fatigue.slice(0, 4).map(f => f.index);
    expect(head[1]).toBeGreaterThan(head[0]);
    expect(head[3]).toBeGreaterThan(head[1]);
  });

  it("夜勤は日勤より疲労度を押し上げる", () => {
    const night = analyzeMonth(2025, 11, fromPattern(["夜"]), {}).fatigue[0].index;
    const day = analyzeMonth(2025, 11, fromPattern(["日"]), {}).fatigue[0].index;
    expect(night).toBeGreaterThan(day);
  });

  it("疲労度は0〜100に収まる", () => {
    const r = analyzeMonth(2025, 11, fillMonth("日", ["当", "残"]), {});
    expect(r.fatigue.every(f => f.index >= 0 && f.index <= 100)).toBe(true);
    expect(r.summary.peak).toBe(100);
  });

  it("通常のローテーションはゆとり圏に収まる", () => {
    const rotation = [];
    for (let i = 0; i < 5; i++) rotation.push("日", "早", "遅", "夜", "明", "休");
    const r = analyzeMonth(2025, 11, fromPattern(rotation), {});
    expect(r.fatigue.every(f => f.level !== "high")).toBe(true);
  });

  it("前月末の勤務が当月初日の疲労度に乗る", () => {
    const shifts = fromPattern(["日"]);
    const heavyPrev = {};
    for (let d = 20; d <= 31; d++) heavyPrev[String(d)] = entry("日");
    const withPrev = analyzeMonth(2025, 11, shifts, heavyPrev);
    const withoutPrev = analyzeMonth(2025, 11, shifts, {});
    expect(withPrev.fatigue[0].index).toBeGreaterThan(withoutPrev.fatigue[0].index);
  });

  it("前月データが無くても例外を出さない", () => {
    expect(() => analyzeMonth(2026, 1, fromPattern(["日"]))).not.toThrow();
    const r = analyzeMonth(2026, 1, fromPattern(["日"]));
    expect(r.fatigue).toHaveLength(31);
  });
});

describe("analyzeMonth - 警告", () => {
  it("4連勤では連勤の警告を出さない", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["日", "日", "日", "日", "休"]), {});
    expect(r.warnings.filter(w => w.type === "streak")).toHaveLength(0);
  });

  it("5連勤で警告を出す", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["日", "日", "日", "日", "日", "休"]), {});
    const streak = r.warnings.find(w => w.type === "streak");
    expect(streak).toMatchObject({ startDay: 1, day: 5, length: 5, fromPrevMonth: false });
    expect(r.streaks.max).toBe(5);
  });

  it("未入力の日は連勤を切る", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["日", "日", "", "日", "日", "日"]), {});
    expect(r.warnings.filter(w => w.type === "streak")).toHaveLength(0);
    expect(r.streaks.max).toBe(3);
  });

  it("前月から続く連勤も拾う", () => {
    const prev = {};
    for (let d = 28; d <= 31; d++) prev[String(d)] = entry("日");
    const r = analyzeMonth(2025, 11, fromPattern(["日", "日", "休"]), prev);
    const streak = r.warnings.find(w => w.type === "streak");
    expect(streak).toMatchObject({ length: 6, fromPrevMonth: true, startDay: 28 });
  });

  it("11時間未満のインターバルを警告する", () => {
    const r = analyzeMonth(2025, 11, fromPattern([["日", ["当"]], "日"]), {});
    const interval = r.warnings.find(w => w.type === "interval");
    expect(interval).toMatchObject({ day: 2, minutes: 105 });
  });

  it("12時間空いていれば警告しない", () => {
    // 遅番 19:00 終業 → 翌日 早番1 7:00 始業
    const r = analyzeMonth(2025, 11, fromPattern(["遅", "早1"]), {});
    expect(r.warnings.filter(w => w.type === "interval")).toHaveLength(0);
  });

  it("夜勤から明け休みはインターバル警告にならない", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["夜", "明", "日"]), {});
    expect(r.warnings.filter(w => w.type === "interval")).toHaveLength(0);
  });

  it("警告は日付順に並ぶ", () => {
    const r = analyzeMonth(2025, 11, fromPattern(["日", "日", "日", "日", "日", "休", ["日", ["当"]], "日"]), {});
    const days = r.warnings.map(w => w.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
});

describe("formatMinutes", () => {
  it("時間と分に直す", () => {
    expect(formatMinutes(525)).toBe("8時間45分");
    expect(formatMinutes(1020)).toBe("17時間");
    expect(formatMinutes(0)).toBe("0時間");
  });
});
