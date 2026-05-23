import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('保存できる', () => {
    const data = {
      year: 2026,
      month: 5,
    };

    localStorage.setItem('shift-data', JSON.stringify(data));

    const loaded = JSON.parse(localStorage.getItem('shift-data'));

    expect(loaded.year).toBe(2026);
  });

  it('空データを処理できる', () => {
    const loaded = localStorage.getItem('not-found');

    expect(loaded).toBeNull();
  });

  it('壊れたJSONを処理できる', () => {
    localStorage.setItem('shift-data', '{ broken json');

    expect(() => {
      JSON.parse(localStorage.getItem('shift-data'));
    }).toThrow();
  });

  it('localStorageエラーを処理できる', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    spy.mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    expect(() => {
      localStorage.setItem('x', 'y');
    }).toThrow();

    spy.mockRestore();
  });
});
