import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as supabaseMock from "../__mocks__/supabase";
import * as icalMock from "../__mocks__/ical";

// モジュールをモックに差し替え
vi.mock("../supabase", () => supabaseMock);
vi.mock("../ical", () => icalMock);

import App from "../App";

// ---- ユーティリティ関数のテスト ----

describe("getDaysInMonth", () => {
  it("2025年11月は30日", () => {
    expect(new Date(2025, 11, 0).getDate()).toBe(30);
  });
  it("2024年2月は29日（うるう年）", () => {
    expect(new Date(2024, 2, 0).getDate()).toBe(29);
  });
  it("2025年2月は28日", () => {
    expect(new Date(2025, 2, 0).getDate()).toBe(28);
  });
  it("1月は31日", () => {
    expect(new Date(2025, 1, 0).getDate()).toBe(31);
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

  const renderAndWait = async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });
  };

  it("ヘッダーに「原田 真依」が表示される", async () => {
    await renderAndWait();
    expect(screen.getByText("原田 真依")).toBeInTheDocument();
  });

  it("「シフト管理」ラベルが表示される", async () => {
    await renderAndWait();
    expect(screen.getByText("シフト管理")).toBeInTheDocument();
  });

  it("カレンダービューとリストビューの切替ボタンが存在する", async () => {
    await renderAndWait();
    // 「📅 カレンダー」ボタン（切替）と「📅 カレンダー出力」ボタンが両方存在する
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

  it("シフト選択ポップアップに全シフト種別が表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText("早番")).toBeInTheDocument();
    expect(screen.getByText("遅番")).toBeInTheDocument();
    expect(screen.getByText("夜勤")).toBeInTheDocument();
    expect(screen.getByText("明け休み")).toBeInTheDocument();
    expect(screen.getByText("当直")).toBeInTheDocument();
    expect(screen.getByText("休み")).toBeInTheDocument();
    expect(screen.getByText("残業")).toBeInTheDocument();
    expect(screen.getByText("会議")).toBeInTheDocument();
  });

  it("シフトを選択するとポップアップが閉じる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("早番"));
    await waitFor(() => {
      expect(screen.queryByText(/日のシフトを選択/)).not.toBeInTheDocument();
    });
  });

  it("シフト選択後にSupabaseのsaveShiftが呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("早番"));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalled();
    });
  });

  it("シフト選択後に集計カードが表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getByText("早番"));
    await waitFor(() => {
      expect(screen.getAllByText("早番").length).toBeGreaterThan(0);
    });
  });

  it("ポップアップ外をクリックすると閉じる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByText(/日のシフトを選択/)).toBeInTheDocument();
    const overlay = document.querySelector('[style*="position: fixed"]');
    fireEvent.click(overlay);
    expect(screen.queryByText(/日のシフトを選択/)).not.toBeInTheDocument();
  });

  it("カレンダー出力ボタンが存在する", async () => {
    await renderAndWait();
    expect(screen.getByText(/カレンダー出力/)).toBeInTheDocument();
  });

  it("カレンダー出力ボタンをクリックするとexportToICalが呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/カレンダー出力/));
    expect(icalMock.exportToICal).toHaveBeenCalled();
  });
});
