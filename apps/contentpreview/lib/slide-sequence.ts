// The first asset is the post's cover in the existing storage model.
export function moveSequenceSlide(order: string[], id: string, target: number) {
  const from = order.indexOf(id);
  if (from < 1 || !Number.isFinite(target)) return order;
  const to = Math.max(1, Math.min(order.length - 1, Math.trunc(target)));
  if (from === to) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function sequenceEdgeSpeed(position: number, start: number, end: number) {
  const edge = Math.min(64, (end - start) / 4);
  if (position < start || position > end || edge <= 0) return 0;
  if (position < start + edge) return -12 * (1 - (position - start) / edge);
  if (position > end - edge) return 12 * (1 - (end - position) / edge);
  return 0;
}
