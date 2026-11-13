/** Windowed source display: scroll through the whole file without creating a
 * DOM element for each line. Each rendered row is exactly SOURCE_ROW_HEIGHT high.
 */
export const SOURCE_ROW_HEIGHT = 19;
export const SOURCE_NEARBY_LINES = 301;
export const SOURCE_VISIBLE_ROWS = 48;
export const SOURCE_OVERSCAN_ROWS = 32;

export interface SourceWindow {
  start: number;
  end: number;
  beforeHeight: number;
  afterHeight: number;
}

export function sourceWindow(
  totalLines: number,
  fullSource: boolean,
  focusLine: number,
  scrollRow: number,
): SourceWindow {
  const total = Math.max(0, Math.trunc(totalLines));
  if (!fullSource) {
    const start = Math.min(
      Math.max(0, Math.trunc(focusLine) - 151),
      Math.max(0, total - SOURCE_NEARBY_LINES),
    );
    return {
      start,
      end: Math.min(total, start + SOURCE_NEARBY_LINES),
      beforeHeight: 0,
      afterHeight: 0,
    };
  }
  const viewportRow = Math.max(0, Math.min(total, Math.trunc(scrollRow)));
  const start = Math.max(0, viewportRow - SOURCE_OVERSCAN_ROWS);
  const end = Math.min(total, start + SOURCE_VISIBLE_ROWS + SOURCE_OVERSCAN_ROWS * 2);
  return {
    start,
    end,
    beforeHeight: start * SOURCE_ROW_HEIGHT,
    afterHeight: (total - end) * SOURCE_ROW_HEIGHT,
  };
}
