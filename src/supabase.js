import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("VITE_SUPABASE_URL と VITE_SUPABASE_KEY を .env.local に設定してください");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 指定月のシフトを全件取得
export async function fetchShifts(year, month) {
  const { data, error } = await supabase
    .from("shifts")
    .select("day, shift_key, alpha")
    .eq("year", year)
    .eq("month", month);

  if (error) throw error;

  // { "1": { base: "早", alpha: ["残", "会"] }, ... } の形式に変換
  const result = {};
  for (const row of data) {
    result[String(row.day)] = {
      base: row.shift_key ?? "",
      alpha: row.alpha ?? [],
    };
  }
  return result;
}

// 1日分のシフトを保存（upsert）
export async function saveShift(year, month, day, shift_key, alpha = []) {
  const { error } = await supabase
    .from("shifts")
    .upsert(
      { year, month, day, shift_key, alpha, updated_at: new Date().toISOString() },
      { onConflict: "year,month,day" }
    );

  if (error) throw error;
}
