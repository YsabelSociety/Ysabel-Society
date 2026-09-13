export function sparkline(values: (number | null | undefined)[]) {
  const actual = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (!actual.length)
    return { path: '', areas: '', points: [] as { x: number; y: number }[] };
  const min = Math.min(...actual),
    max = Math.max(...actual);
  const points: { x: number; y: number }[] = [];
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      if (segment.length) segments.push(segment);
      segment = [];
      continue;
    }
    const point = {
      x: values.length === 1 ? 60 : 3 + (i / (values.length - 1)) * 114,
      y: max === min ? 22 : 36 - ((value - min) / (max - min)) * 28,
    };
    segment.push(point);
    points.push(point);
  }
  if (segment.length) segments.push(segment);
  const line = (s: typeof points) =>
    s
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');
  return {
    points,
    path: segments.map(line).join(' '),
    areas: segments
      .filter((s) => s.length > 1)
      .map((s) => `${line(s)} L${s.at(-1)!.x},43 L${s[0].x},43 Z`)
      .join(' '),
  };
}
