export function mediaGridWindow({ count, width, minWidth, gap, rowGap, extraHeight, scrollTop, viewportHeight, overscan = 2 }: {
  count: number; width: number; minWidth: number; gap: number; rowGap: number; extraHeight: number;
  scrollTop: number; viewportHeight: number; overscan?: number;
}) {
  const columns = Math.max(1, Math.floor((Math.max(1, width) + gap) / (minWidth + gap)));
  const itemWidth = Math.max(1, (width - (columns - 1) * gap) / columns);
  const itemHeight = itemWidth * 1.25 + extraHeight;
  const pitch = itemHeight + rowGap;
  const rows = Math.ceil(count / columns);
  const visibleRows = Math.max(1, Math.ceil(viewportHeight / pitch));
  const startRow = Math.min(Math.max(0, rows - visibleRows), Math.max(0, Math.floor(scrollTop / pitch) - overscan));
  const endRow = Math.min(rows, Math.max(startRow + visibleRows + overscan * 2 + 1, Math.ceil((scrollTop + viewportHeight) / pitch) + overscan));
  return { columns, itemWidth, itemHeight, pitch, start: startRow * columns, end: Math.min(count, endRow * columns), totalHeight: Math.max(0, rows * pitch - rowGap) };
}
