'use client';
import { Activity, useState, type ReactNode } from 'react';

// Retain chart filters after the first visit without rendering unvisited pages.
export function VisitedPanel({ active, children, retainCharts = false }: { active: boolean; children: ReactNode; retainCharts?: boolean }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!active && !visited) return null;
  // Charts have no continuous data polling. Preserve their measured SVGs
  // instead of restarting dozens of chart effects when Performance returns.
  if (retainCharts) return <div hidden={!active} className="retained-report-panel">{children}</div>;
  return <Activity mode={active ? 'visible' : 'hidden'}>{children}</Activity>;
}
