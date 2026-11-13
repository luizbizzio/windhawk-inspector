import { describe, expect, it } from 'vitest';
import {
  sourceWindow, SOURCE_NEARBY_LINES, SOURCE_VISIBLE_ROWS,
  SOURCE_OVERSCAN_ROWS, SOURCE_ROW_HEIGHT,
} from '../src/source-window';

describe('source viewer modes', () => {
  it('keeps the entire short file visible in nearby mode', () => {
    expect(sourceWindow(40, false, 0, 0)).toEqual({
      start: 0, end: 40, beforeHeight: 0, afterHeight: 0,
    });
  });

  it('centers nearby lines on source references without losing the end of the file', () => {
    expect(sourceWindow(1000, false, 500, 0)).toMatchObject({
      start: 349, end: 650,
    });
    expect(sourceWindow(1000, false, 999, 0)).toMatchObject({
      start: 699, end: 1000,
    });
    expect(sourceWindow(1000, false, 1, 0).end).toBe(SOURCE_NEARBY_LINES);
  });

  it('shows every line of a small file in full mode', () => {
    expect(sourceWindow(410, true, 0, 0)).toMatchObject({
      start: 0,
      end: SOURCE_VISIBLE_ROWS + 2 * SOURCE_OVERSCAN_ROWS,
      beforeHeight: 0,
    });
    const bottom = sourceWindow(410, true, 0, 409);
    expect(bottom.end).toBe(410);
    expect(bottom.start).toBeLessThanOrEqual(409);
  });

  it('allows scrolling through the entire large source with bounded DOM rows', () => {
    const count = 250_000;
    const maxRows = SOURCE_VISIBLE_ROWS + 2 * SOURCE_OVERSCAN_ROWS;
    for (const row of [0, 1, 10, 1000, 125000, 249999]) {
      const result = sourceWindow(count, true, 0, row);
      expect(result.start).toBeGreaterThanOrEqual(0);
      expect(result.end).toBeLessThanOrEqual(count);
      expect(result.end-result.start).toBeLessThanOrEqual(maxRows);
      expect(result.start).toBeLessThanOrEqual(row);
      expect(result.end).toBeGreaterThan(row);
      expect(result.beforeHeight + result.afterHeight +
        (result.end - result.start) * SOURCE_ROW_HEIGHT,
      ).toBe(count * SOURCE_ROW_HEIGHT);
    }
  });

  it('handles empty, short, and extreme scroll positions', () => {
    expect(sourceWindow(0, true, 0, 100)).toEqual({
      start: 0, end: 0, beforeHeight: 0, afterHeight: 0,
    });
    expect(sourceWindow(3, true, 0, -500).end).toBe(3);
    expect(sourceWindow(10000, true, 0, 9999999).end).toBe(10000);
  });
});
