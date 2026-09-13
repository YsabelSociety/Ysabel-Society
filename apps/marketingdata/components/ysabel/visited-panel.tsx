'use client';
import { useState, type ReactNode } from 'react';

// Retain chart filters after the first visit without rendering unvisited pages.
export function VisitedPanel({ active, children, retainCharts = false }: { active: boolean; children: ReactNode; retainCharts?: boolean }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!active && !visited) return null;
  // Browser-level hiding skips layout and paint while preserving effects and
  // controls. Restarting page effects on every switch caused visible pauses.
  return <div hidden={!active} className={retainCharts ? 'retained-report-panel' : 'visited-panel'}>{children}</div>;
}
