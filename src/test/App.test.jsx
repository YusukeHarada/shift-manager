import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as supabaseMock from "../__mocks__/supabase";
import * as icalMock from "../__mocks__/ical";

vi.mock("../supabase", () => supabaseMock);
vi.mock("../ical", () => icalMock);

import App from "../App";

// ---- ユーティリティ関数のテスト（カレンダー描画で間接検証） ----

describe("getDaysInMonth（カレンダー描画）", () => {
  const mockSession = { user: { email: "test@shift.local" } };

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.fetchShifts.mockResolvedValue({});
    // Date のみを偽装（setTimeout は本物のまま残すことで waitFor が動作する）
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => { vi.useRealTimers(); });

  it("2025年2月は28日（カレンダーに28が表示される）", async () => {
    vi.setSystemTime(new Date(2025, 1, 1));
    render(<App session={mockSession} />);
    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.queryByText("29")).not.toBeInTheDocument();
  });

  it("2024年2月は29日（うるう年）", async () => {
    vi.setSystemTime(new Date(2024, 1, 1));
    render(<App session={mockSession} />);
    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.queryByText("30")).not.toBeInTheDocument();
  });
});

describe("getFirstDayOfWeek", () => {
  it("2025年11月1日は土曜日（6）", () => {
    expect(new Date(2025, 10, 1).getDay()).toBe(6);
  });
  it("2026年1月1日は木曜日（4）", () => {
    expect(new Date(2026, 0, 1).getDay()).toBe(4);
  });
});

// ---- Appコンポーネントのテスト ----

describe("App コンポーネント", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.fetchShifts.mockResolvedValue({});
  });

  const mockSession = { user: { email: "test@shift.local" } };

  const renderAndWait = async () => {
    render(<App session={mockSession} />);
    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });
  };

  it("ヘッダーに「ユーザ」が表示される", async () => {
    await renderAndWait();
    expect(screen.getByText("ユーザ")).toBeInTheDocument();
  });

  it("「シフト管理」ラベルが表示される", async () => {
    await renderAndWait();
    expect(screen.getByText("シフト管理")).toBeInTheDocument();
  });

  it("カレンダービューとリストビューの切替ボタンが存在する", async () => {
    await renderAndWait();
    const calBtns = screen.getAllByText(/カレンダー/);
    expect(calBtns.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/リスト/)).toBeInTheDocument();
  });

  it("月ナビの‹›ボタンが存在する", async () => {
    await renderAndWait();
    expect(screen.getByText("‹")).toBeInTheDocument();
    expect(screen.getByText("›")).toBeInTheDocument();
  });

  it("›ボタンで翌月に進める", async () => {
    await renderAndWait();
    const today = new Date();
    const nextMonth = today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2;
    const nextYear = today.getMonth() + 2 > 12 ? today.getFullYear() + 1 : today.getFullYear();
    fireEvent.click(screen.getByText("›"));
    await waitFor(() => {
      expect(screen.getByText(`${nextYear}年${nextMonth}月`)).toBeInTheDocument();
    });
  });

  it("‹ボタンで前月に戻れる", async () => {
    await renderAndWait();
    const today = new Date();
    const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth();
    const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    fireEvent.click(screen.getByText("‹"));
    await waitFor(() => {
      expect(screen.getByText(`${prevYear}年${prevMonth}月`)).toBeInTheDocument();
    });
  });

  it("リストビューに切り替えられる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/リスト/));
    await waitFor(() => {
      expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    });
  });

  it("日付をタップするとシフト選択ポップアップが開く", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText(/日のシフトを選択/)).toBeInTheDocument();
  });

  it("ポップアップにベースシフト種別が表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText("日勤")).toBeInTheDocument();
    expect(screen.getByText("早番")).toBeInTheDocument();
    expect(screen.getByText("遅番")).toBeInTheDocument();
    expect(screen.getByText("夜勤")).toBeInTheDocument();
    expect(screen.getByText("明け休み")).toBeInTheDocument();
    expect(screen.getByText("休み")).toBeInTheDocument();
  });

  it("ポップアップにαオプションが表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText("残業")).toBeInTheDocument();
    expect(screen.getByText("会議")).toBeInTheDocument();
  });

  it("ポップアップに保存ボタンが存在する", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText("保存")).toBeInTheDocument();
  });

  it("保存ボタンをクリックするとポップアップが閉じる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(screen.queryByText(/日のシフトを選択/)).not.toBeInTheDocument();
    });
  });

  it("保存後にSupabaseのsaveShiftが呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("早番"));
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        1,
        "早",
        expect.any(Array)
      );
    });
  });

  it("ポップアップにAM休・PM休オプションが表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText("AM休")).toBeInTheDocument();
    expect(screen.getByText("PM休")).toBeInTheDocument();
  });

  it("遅番＋AM休を保存できる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("遅番"));
    fireEvent.click(screen.getByText("AM休"));
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        1,
        "遅",
        ["前休"]
      );
    });
  });

  it("AM休とPM休は排他選択になる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("日勤"));
    fireEvent.click(screen.getByText("AM休"));
    fireEvent.click(screen.getByText("PM休"));
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        1,
        "日",
        ["後休"]
      );
    });
  });

  it("半休は残業・会議と併用できる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("早番"));
    fireEvent.click(screen.getByText("PM休"));
    fireEvent.click(screen.getByText("会議"));
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        1,
        "早",
        expect.arrayContaining(["後休", "会"])
      );
    });
  });

  it("αオプションを複数選択できる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("残業"));
    fireEvent.click(screen.getByText("会議"));
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        1,
        expect.any(String),
        expect.arrayContaining(["残", "会"])
      );
    });
  });

  it("シフト選択後に集計カードが表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("早番"));
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(screen.getAllByText("早番").length).toBeGreaterThan(0);
    });
  });

  it("ポップアップ外をクリックすると閉じる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText(/日のシフトを選択/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shift-picker-overlay"));
    expect(screen.queryByText(/日のシフトを選択/)).not.toBeInTheDocument();
  });

  it("カレンダー出力ボタンが存在する", async () => {
    await renderAndWait();
    expect(screen.getByText(/^出力$/)).toBeInTheDocument();
  });

  it("カレンダー出力ボタンをクリックするとexportToICalが呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/^出力$/).closest("button"));
    expect(icalMock.exportToICal).toHaveBeenCalled();
  });

  it("カレンダー出力時にユーザ名が引数として渡される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/^出力$/).closest("button"));
    expect(icalMock.exportToICal).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Object),
      "ユーザ"
    );
  });

  it("ログアウトボタンが存在する", async () => {
    await renderAndWait();
    expect(screen.getByText(/ログアウト/)).toBeInTheDocument();
  });

  it("ログアウトボタンをクリックするとsignOutが呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/ログアウト/));
    await waitFor(() => {
      expect(supabaseMock.supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  it("Supabaseにデータがある場合シフトが表示される", async () => {
    supabaseMock.fetchShifts.mockResolvedValue({
      "1": { base: "早", alpha: [] },
      "2": { base: "夜", alpha: ["残"] },
    });
    await renderAndWait();
    // カレンダーに早番・夜勤のバッジが表示される
    expect(screen.getAllByText("早").length).toBeGreaterThan(0);
    expect(screen.getAllByText("夜").length).toBeGreaterThan(0);
  });

  it("一括保存が失敗した場合にUIがロールバックされる", async () => {
    supabaseMock.fetchShifts.mockResolvedValue({});
    supabaseMock.saveShift.mockRejectedValue(new Error("network error"));
    await renderAndWait();

    fireEvent.click(screen.getByLabelText("入力モード開始"));
    await waitFor(() => expect(screen.getByTestId("shift-input-panel")).toBeInTheDocument());

    const shiftBtn = screen.getByTestId("shift-input-panel").querySelector('[data-shift="早"]');
    fireEvent.click(shiftBtn);

    // 日付を選択
    const calendarCells = document.querySelectorAll(".calendar-cell");
    fireEvent.click(calendarCells[0]);

    fireEvent.click(screen.getByText(/保存（/));

    await waitFor(() => {
      expect(screen.getByText(/件の保存に失敗しました/)).toBeInTheDocument();
    });
  });
});

describe("設定パネル（週開始・テーマ）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    supabaseMock.fetchShifts.mockResolvedValue({});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2025, 10, 1)); // 2025年11月1日は土曜日
  });
  afterEach(() => { vi.useRealTimers(); });

  const mockSession = { user: { email: "test@shift.local" } };

  const renderAndWait = async () => {
    render(<App session={mockSession} />);
    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });
  };

  it("デフォルトは月曜始まりでカレンダーの1列目が月曜になる", async () => {
    await renderAndWait();
    const weekdayEls = document.querySelectorAll(".calendar-weekday");
    expect(weekdayEls[0].textContent).toBe("月");
    expect(weekdayEls[6].textContent).toBe("日");
  });

  it("設定パネルで日曜始まりに切り替えるとカレンダーの列順が変わる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText("設定"));
    fireEvent.click(screen.getByText("日曜始まり"));

    const weekdayEls = document.querySelectorAll(".calendar-weekday");
    expect(weekdayEls[0].textContent).toBe("日");
    expect(weekdayEls[6].textContent).toBe("土");
  });

  it("週開始の設定がlocalStorageに保存される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText("設定"));
    fireEvent.click(screen.getByText("日曜始まり"));
    expect(localStorage.getItem("shift-manager:weekStart")).toBe("sun");
  });

  it("テーマを選択するとdata-theme属性が変わりlocalStorageに保存される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText("設定"));
    fireEvent.click(screen.getByLabelText("オーシャン"));

    expect(document.documentElement.getAttribute("data-theme")).toBe("ocean");
    expect(localStorage.getItem("shift-manager:theme")).toBe("ocean");
  });
});

describe("設定パネル（表示モード）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute("data-mode");
    supabaseMock.fetchShifts.mockResolvedValue({});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2025, 10, 1));
  });
  afterEach(() => { vi.useRealTimers(); });

  const mockSession = { user: { email: "test@shift.local" } };

  const openSettings = async () => {
    render(<App session={mockSession} />);
    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("設定"));
  };

  it("デフォルトは自動で、data-mode 属性は付かない", async () => {
    await openSettings();
    expect(document.documentElement.hasAttribute("data-mode")).toBe(false);
    expect(localStorage.getItem("shift-manager:mode")).toBe("auto");
  });

  it("ダークを選ぶと data-mode=dark になり localStorage に保存される", async () => {
    await openSettings();
    fireEvent.click(screen.getByText("ダーク"));

    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
    expect(localStorage.getItem("shift-manager:mode")).toBe("dark");
  });

  it("ライトを選ぶと data-mode=light になる", async () => {
    await openSettings();
    fireEvent.click(screen.getByText("ライト"));

    expect(document.documentElement.getAttribute("data-mode")).toBe("light");
  });

  it("ダークから自動に戻すと data-mode 属性が外れる", async () => {
    await openSettings();
    fireEvent.click(screen.getByText("ダーク"));
    fireEvent.click(screen.getByText("自動"));

    expect(document.documentElement.hasAttribute("data-mode")).toBe(false);
    expect(localStorage.getItem("shift-manager:mode")).toBe("auto");
  });

  it("保存済みのモードが次回の起動で復元される", async () => {
    localStorage.setItem("shift-manager:mode", "dark");
    await openSettings();
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
  });
});

describe("次の出勤カード", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2025, 10, 10)); // 2025年11月10日（月）
  });
  afterEach(() => { vi.useRealTimers(); });

  const mockSession = { user: { email: "test@shift.local" } };

  const renderWith = async (shifts) => {
    supabaseMock.fetchShifts.mockResolvedValue(shifts);
    render(<App session={mockSession} />);
    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
  };

  it("次の出勤日・曜日・勤務時間が表示される", async () => {
    await renderWith({ "12": { base: "早", alpha: [] } });

    expect(screen.getByText("11月12日")).toBeInTheDocument();
    expect(screen.getByText("（水）")).toBeInTheDocument();
    expect(screen.getByText("7:30 〜 16:15")).toBeInTheDocument();
  });

  it("バッジは略称ではなく正式名称で出る", async () => {
    await renderWith({ "12": { base: "早", alpha: [] } });

    const badge = document.querySelector(".next-shift-card .shift-badge");
    expect(badge.textContent).toBe("早番");
  });

  it("勤務時間を持たないシフト（明け休み）では時間を出さない", async () => {
    await renderWith({ "12": { base: "明", alpha: [] } });

    expect(screen.getByText("11月12日")).toBeInTheDocument();
    expect(document.querySelector(".next-shift-card__time")).toBeNull();
  });

  it("休みは次の出勤に数えない", async () => {
    await renderWith({ "11": { base: "休", alpha: [] }, "13": { base: "日", alpha: [] } });

    expect(screen.getByText("11月13日")).toBeInTheDocument();
  });
});

describe("月の内訳（積み上げバーとチップ）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2025, 10, 1));
  });
  afterEach(() => { vi.useRealTimers(); });

  const mockSession = { user: { email: "test@shift.local" } };

  const renderWith = async (shifts) => {
    supabaseMock.fetchShifts.mockResolvedValue(shifts);
    render(<App session={mockSession} />);
    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
  };

  it("ベースシフトの件数分だけバーが分割される", async () => {
    await renderWith({
      "1": { base: "早", alpha: [] },
      "2": { base: "早", alpha: [] },
      "3": { base: "夜", alpha: [] },
      "4": { base: "休", alpha: [] },
    });

    const segs = document.querySelectorAll(".summary-bar__seg");
    expect(segs).toHaveLength(3);
    // 早番が2/4なので50%
    expect(segs[0].style.width).toBe("50%");
  });

  it("チップに種別と件数が出る", async () => {
    await renderWith({
      "1": { base: "早", alpha: ["残"] },
      "2": { base: "早", alpha: [] },
    });

    const chips = [...document.querySelectorAll(".summary-chip")].map(c => c.textContent);
    expect(chips).toContain("早番2");
    expect(chips).toContain("残業1");
  });

  it("シフトが1件もない月は内訳を出さない", async () => {
    await renderWith({});
    expect(document.querySelector(".summary-bar")).toBeNull();
  });
});
