import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as supabaseMock from "../__mocks__/supabase";

vi.mock("../supabase", () => supabaseMock);

import Login from "../Login";

describe("Login コンポーネント", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.supabase.auth.signInWithPassword.mockResolvedValue({ error: null });
  });

  it("メールとパスワードの入力欄が存在する", () => {
    render(<Login />);
    expect(screen.getByPlaceholderText(/yusuke@shift\.local/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("パスワード")).toBeInTheDocument();
  });

  it("フィールドが空のときログインボタンは無効", () => {
    render(<Login />);
    expect(screen.getByText("ログイン")).toBeDisabled();
  });

  it("メールとパスワードを入力するとログインボタンが有効になる", () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText(/yusuke@shift\.local/), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("パスワード"), { target: { value: "pass" } });
    expect(screen.getByText("ログイン")).not.toBeDisabled();
  });

  it("ログインボタンをクリックするとsignInWithPasswordが呼ばれる", async () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText(/yusuke@shift\.local/), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("パスワード"), { target: { value: "pass" } });
    fireEvent.click(screen.getByText("ログイン"));
    await waitFor(() => {
      expect(supabaseMock.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "pass",
      });
    });
  });

  it("パスワード欄でEnterを押すとログインが実行される", async () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText(/yusuke@shift\.local/), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("パスワード"), { target: { value: "pass" } });
    fireEvent.keyDown(screen.getByPlaceholderText("パスワード"), { key: "Enter" });
    await waitFor(() => {
      expect(supabaseMock.supabase.auth.signInWithPassword).toHaveBeenCalled();
    });
  });

  it("ログイン失敗時にエラーメッセージが表示される", async () => {
    supabaseMock.supabase.auth.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid credentials"),
    });
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText(/yusuke@shift\.local/), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("パスワード"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("ログイン"));
    await waitFor(() => {
      expect(screen.getByText("メールアドレスまたはパスワードが正しくありません")).toBeInTheDocument();
    });
  });

  it("ログイン中は「ログイン中...」と表示される", async () => {
    let resolve;
    supabaseMock.supabase.auth.signInWithPassword.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText(/yusuke@shift\.local/), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("パスワード"), { target: { value: "pass" } });
    fireEvent.click(screen.getByText("ログイン"));
    expect(await screen.findByText("ログイン中...")).toBeInTheDocument();
    resolve({ error: null });
  });
});
