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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif",
      padding: "20px",
    }}>
      <div style={{
        background: "#fff", borderRadius: "20px", padding: "32px 24px",
        width: "100%", maxWidth: "360px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>📅</div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#1a1a2e" }}>シフト管理</div>
          <div style={{ fontSize: "13px", color: "#888", marginTop: "4px" }}>ログインしてください</div>
        </div>

        {error && (
          <div style={{
            background: "#FDEDEC", border: "1.5px solid #e74c3c",
            borderRadius: "8px", padding: "10px 14px",
            fontSize: "13px", color: "#e74c3c", marginBottom: "16px"
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="例: yusuke@shift.local"
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              border: "1.5px solid #ddd", fontSize: "15px",
              boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="パスワード"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              border: "1.5px solid #ddd", fontSize: "15px",
              boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={!email || !password || loading}
          style={{
            width: "100%", padding: "14px", borderRadius: "12px",
            border: "none", fontSize: "15px", fontWeight: "700",
            background: email && password && !loading ? "#4A90D9" : "#ccc",
            color: "#fff", cursor: email && password && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </div>
  );
}
