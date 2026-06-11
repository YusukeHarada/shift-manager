import { vi } from "vitest";
export const fetchShifts = vi.fn().mockResolvedValue({});
export const saveShift = vi.fn().mockResolvedValue(undefined);
export const supabase = {
  auth: {
    signOut: vi.fn().mockResolvedValue({}),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
  },
};
