import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Login from "./Login";
import { supabase } from "./supabase";

function Root() {
  const [session, setSession] = useState(undefined); // undefined=確認中

  useEffect(() => {
    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // セッションの変化を監視（ログイン・ログアウト時に自動更新）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // セッション確認中はローディング表示
  if (session === undefined) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: "14px",
        fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif",
      }}>
        読み込み中...
      </div>
    );
  }

  // 未ログインならログイン画面、ログイン済みならアプリ画面
  return session ? <App session={session} /> : <Login />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
