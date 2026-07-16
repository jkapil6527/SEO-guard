'use client';

import { useEffect, useState } from 'react';

/**
 * Charts read their colours from the CSS token layer at render time, so they
 * follow light/dark like everything else. The previous charts used hardcoded hex
 * and stayed frozen in one theme.
 */
function useToken(name: string, fallback: string): string {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const read = () =>
      setValue(
        getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback,
      );
    read();
    // The theme toggle flips a class on <html>; re-read when it does.
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [name, fallback]);
  return value;
}

function bandOf(score: number): string {
  if (score >= 90) return '--success';
  if (score >= 70) return '--warning';
  return '--danger';
}

/** Circular health score. */
export function HealthGauge({ score, size = 56 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const colour = useToken(bandOf(value), '#64748b');
  const track = useToken('--surface-hover', '#e2e8f0');
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = score === null ? 0 : (value / 100) * c;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? 'No score yet' : `Health score ${Math.round(value)} of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c - filled}`}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-text tabular-nums">
        {score === null ? '—' : Math.round(value)}
      </span>
    </div>
  );
}

/** Compact trend line. Renders nothing rather than a misleading flat line for <2 points. */
export function Sparkline({ values, height = 24 }: { values: number[]; height?: number }) {
  const colour = useToken('--primary', '#2563eb');
  if (values.length < 2) {
    return <p className="text-xs text-faint">Not enough history yet</p>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      height={height}
      className="w-full"
      role="img"
      aria-label={`Score trend: ${values.length} points, latest ${values[values.length - 1]}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={colour}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
