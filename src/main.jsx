import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
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
        minHeight: "100dvh",
        background: "var(--color-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--color-text-muted)", fontSize: "16px",
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
