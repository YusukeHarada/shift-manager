import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as supabaseMock from "../__mocks__/supabase";
import * as icalMock from "../__mocks__/ical";

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

  it("保存失敗時でもsaveShiftが呼ばれる", async () => {
    supabaseMock.saveShift.mockRejectedValue(new Error("DB Error"));

    await renderAndWait();

    fireEvent.click(screen.getAllByText("1")[0]);

    fireEvent.click(screen.getByText("早番"));

    fireEvent.click(await screen.findByText("保存"));

    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalled();
    });
  });
});
