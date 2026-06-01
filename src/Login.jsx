import { useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e) {
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = email && password && !loading;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">📅</div>
        <div className="login-title">シフト管理</div>
        <div className="login-subtitle">ログインしてください</div>

        {error && (
          <div className="error-banner" style={{ marginBottom: "20px" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label className="form-label">メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="例: yusuke@shift.local"
            className="form-input"
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label className="form-label">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="パスワード"
            onKeyDown={e => e.key === "Enter" && canSubmit && handleLogin()}
            className="form-input"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={!canSubmit}
          className={`login-submit ${canSubmit ? "login-submit--active" : "login-submit--disabled"}`}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </div>
  );
}
