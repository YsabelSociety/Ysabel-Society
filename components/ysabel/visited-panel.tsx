'use client';
import { Activity, useState, type ReactNode } from 'react';

// Retain chart filters after the first visit without rendering unvisited pages.
export function VisitedPanel({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!active && !visited) return null;
  return <Activity mode={active ? 'visible' : 'hidden'}>{children}</Activity>;
}
