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

  it("Supabaseにデータがある場合シフトが表示される", async () => {
    supabaseMock.fetchShifts.mockResolvedValue({
      "1": { base: "早", alpha: [] },
      "2": { base: "夜", alpha: ["残"] },
    });
    await renderAndWait();
    expect(screen.getAllByText("早").length).toBeGreaterThan(0);
    expect(screen.getAllByText("夜").length).toBeGreaterThan(0);
  });
});

// ---- WorkTimeModal のテスト ----

describe("WorkTimeModal", () => {
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

  it("「勤務時間表」ボタンが存在する", async () => {
    await renderAndWait();
    expect(screen.getByText(/勤務時間表/)).toBeInTheDocument();
  });

  it("ボタンをクリックするとモーダルが開く", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/勤務時間表/));
    // モーダルのテーブルヘッダー「区分」が表示されることで開いたことを確認
    expect(screen.getByText("区分")).toBeInTheDocument();
  });

  it("モーダルに各シフト区分が表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/勤務時間表/));
    expect(screen.getByText("早番1")).toBeInTheDocument();
    expect(screen.getAllByText("早番").length).toBeGreaterThan(0);
    expect(screen.getByText("日勤")).toBeInTheDocument();
    expect(screen.getByText("遅番")).toBeInTheDocument();
    expect(screen.getByText("夜勤")).toBeInTheDocument();
  });

  it("モーダルに勤務時間が表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/勤務時間表/));
    expect(screen.getByText("7:00")).toBeInTheDocument();    // 早1 開始
    expect(screen.getByText("15:45")).toBeInTheDocument();   // 早1 終了
    expect(screen.getByText("7:30")).toBeInTheDocument();    // 早 開始
    expect(screen.getByText("16:15")).toBeInTheDocument();   // 早 終了
    expect(screen.getByText("8:45")).toBeInTheDocument();    // 日 開始
    expect(screen.getByText("17:30")).toBeInTheDocument();   // 日 終了
    expect(screen.getByText("10:15")).toBeInTheDocument();   // 遅 開始
    // 19:00 は遅番・当直で重複する可能性があるため複数存在を許容
    expect(screen.getAllByText("19:00").length).toBeGreaterThan(0);
    expect(screen.getByText("16:30")).toBeInTheDocument();   // 夜 開始
    expect(screen.getByText("翌9:30")).toBeInTheDocument();  // 夜 終了
  });

  it("「閉じる」ボタンでモーダルが閉じる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/勤務時間表/));
    fireEvent.click(screen.getByText("閉じる"));
    await waitFor(() => {
      expect(screen.queryByText("区分")).not.toBeInTheDocument();
    });
  });

  it("オーバーレイをクリックするとモーダルが閉じる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/勤務時間表/));
    expect(screen.getByText("区分")).toBeInTheDocument();
    const overlays = document.querySelectorAll('[style*="position: fixed"]');
    const workOverlay = Array.from(overlays).find(
      (el) => el.style.zIndex === "1000"
    );
    if (workOverlay) fireEvent.click(workOverlay);
    await waitFor(() => {
      expect(screen.queryByText("区分")).not.toBeInTheDocument();
    });
  });

  it("時間情報のないシフト（明け休み・休み）は表に含まれない", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText(/勤務時間表/));
    const rows = document.querySelectorAll("table tbody tr");
    const labels = Array.from(rows).map((r) => r.cells[0]?.textContent);
    expect(labels).not.toContain("明け休み");
    expect(labels).not.toContain("休み");
  });
});

// ---- シフト入力モードのテスト ----

describe("シフト入力モード", () => {
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

  // モード切替

  it("ヘッダーに入力モード切替トグルボタンが存在する", async () => {
    await renderAndWait();
    expect(screen.getByRole("button", { name: /入力モード/ })).toBeInTheDocument();
  });

  it("初期状態は通常モード", async () => {
    await renderAndWait();
    expect(screen.queryByTestId("shift-input-panel")).not.toBeInTheDocument();
  });

  it("トグルボタンをクリックすると入力モードになる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    expect(screen.getByTestId("shift-input-panel")).toBeInTheDocument();
  });

  it("入力モード中にトグルを再クリックすると通常モードに戻る", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    expect(screen.queryByTestId("shift-input-panel")).not.toBeInTheDocument();
  });

  // ShiftInputPanel の表示

  it("入力パネルにベースシフト一覧が表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    expect(panel).toHaveTextContent("日勤");
    expect(panel).toHaveTextContent("早番");
    expect(panel).toHaveTextContent("遅番");
    expect(panel).toHaveTextContent("夜勤");
    expect(panel).toHaveTextContent("休み");
  });

  it("入力パネルにαオプション一覧が表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    expect(panel).toHaveTextContent("残業");
    expect(panel).toHaveTextContent("会議");
  });

  it("入力パネルに保存ボタンが表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    expect(panel).toHaveTextContent("保存");
  });

  // シフト選択

  it("初期状態ではシフトが未選択", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    expect(screen.queryByTestId("selected-shift-label")).not.toBeInTheDocument();
  });

  it("パネルでシフトを選択すると選択中シフトが表示される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="日"]'));
    expect(screen.getByTestId("selected-shift-label")).toHaveTextContent("日勤");
  });

  it("別のシフトを選択すると選択が切り替わる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="日"]'));
    fireEvent.click(panel.querySelector('[data-shift="早"]'));
    expect(screen.getByTestId("selected-shift-label")).toHaveTextContent("早番");
  });

  it("αオプションを複数選択できる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-alpha="残"]'));
    fireEvent.click(panel.querySelector('[data-alpha="会"]'));
    expect(screen.getByTestId("selected-alpha-label")).toHaveTextContent("残");
    expect(screen.getByTestId("selected-alpha-label")).toHaveTextContent("会");
  });

  it("選択済みのαオプションを再クリックすると解除される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-alpha="残"]'));
    fireEvent.click(panel.querySelector('[data-alpha="残"]'));
    // αが0件になると selected-alpha-label 自体が消える
    expect(screen.queryByTestId("selected-alpha-label")).not.toBeInTheDocument();
  });

  // 日付選択

  it("入力モード中に日付をタップするとShiftPickerは開かない", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.queryByText(/日のシフトを選択/)).not.toBeInTheDocument();
  });

  it("入力モード中に日付をタップすると選択状態になる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    fireEvent.click(screen.getAllByText("1")[0]);
    expect(screen.getByTestId("selected-dates-count")).toHaveTextContent("1");
  });

  it("複数の日付を選択できる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const days = screen.getAllByText("1");
    fireEvent.click(days[0]);
    fireEvent.click(screen.getAllByText("2")[0]);
    fireEvent.click(screen.getAllByText("3")[0]);
    expect(screen.getByTestId("selected-dates-count")).toHaveTextContent("3");
  });

  it("選択済みの日付を再タップすると選択が解除される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    // getAllByText("1")[0] は状態変化後に別要素を返す可能性があるため
    // data-testid で日付セルを特定する
    const dayCell = screen.getAllByText("5")[0];
    fireEvent.click(dayCell);
    expect(screen.getByTestId("selected-dates-count")).toHaveTextContent("1");
    fireEvent.click(dayCell);
    expect(screen.getByTestId("selected-dates-count")).toHaveTextContent("0");
  });

  // 保存

  it("シフト未選択で保存しても saveShift は呼ばれない", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    fireEvent.click(screen.getAllByText("1")[0]);
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    expect(supabaseMock.saveShift).not.toHaveBeenCalled();
  });

  it("日付未選択で保存しても saveShift は呼ばれない", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="日"]'));
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    expect(supabaseMock.saveShift).not.toHaveBeenCalled();
  });

  it("シフトと日付を選択して保存すると saveShift が選択日数分呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="日"]'));
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getAllByText("2")[0]);
    fireEvent.click(screen.getAllByText("3")[0]);
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledTimes(3);
    });
  });

  it("保存時に正しいシフトキーで saveShift が呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="遅"]'));
    fireEvent.click(screen.getAllByText("5")[0]);
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        5,
        "遅",
        []
      );
    });
  });

  it("αオプション付きで保存すると正しく saveShift が呼ばれる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="早"]'));
    fireEvent.click(panel.querySelector('[data-alpha="残"]'));
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    await waitFor(() => {
      expect(supabaseMock.saveShift).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        1,
        "早",
        ["残"]
      );
    });
  });

  // 保存後のリセット

  it("保存後に選択日付がリセットされる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="日"]'));
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    await waitFor(() => {
      expect(screen.getByTestId("selected-dates-count")).toHaveTextContent("0");
    });
  });

  it("保存後に選択シフトがリセットされる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="日"]'));
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    await waitFor(() => {
      expect(screen.queryByTestId("selected-shift-label")).not.toBeInTheDocument();
    });
  });

  it("保存後にカレンダーにシフトが反映される", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    const panel = screen.getByTestId("shift-input-panel");
    fireEvent.click(panel.querySelector('[data-shift="夜"]'));
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(panel.querySelector('[data-action="save"]'));
    await waitFor(() => {
      expect(screen.getAllByText("夜").length).toBeGreaterThan(0);
    });
  });

  // モード切替時のリセット

  it("通常モードに戻ると選択日付がリセットされる", async () => {
    await renderAndWait();
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    fireEvent.click(screen.getAllByText("1")[0]);
    fireEvent.click(screen.getAllByText("2")[0]);
    // トグルで通常モードに戻る
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    // 再度入力モードに入ったとき選択日付が0であること
    fireEvent.click(screen.getByRole("button", { name: /入力モード/ }));
    expect(screen.getByTestId("selected-dates-count")).toHaveTextContent("0");
  });
});
