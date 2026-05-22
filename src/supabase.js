import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 指定月のシフトを全件取得
export async function fetchShifts(year, month) {
  const { data, error } = await supabase
    .from("shifts")
    .select("day, shift_key")
    .eq("year", year)
    .eq("month", month);

  if (error) throw error;

  // { "1": "早", "2": "夜", ... } の形式に変換
  const result = {};
  for (const row of data) {
    result[String(row.day)] = row.shift_key;
  }
  return result;
}

// 1日分のシフトを保存（upsert: なければ追加、あれば更新）
export async function saveShift(year, month, day, shift_key) {
  const { error } = await supabase
    .from("shifts")
    .upsert(
      { year, month, day, shift_key, updated_at: new Date().toISOString() },
      { onConflict: "year,month,day" }
    );

  if (error) throw error;
}
