'use client';

/**
 * Dependency-free SVG charts. Small, theme-aware, good enough for a dashboard:
 * a line chart for trends, a horizontal bar list for distributions, a donut for
 * proportions, and a score gauge.
 */

const SERIES_COLOR = '#3b82f6';

export function LineChart({
  points,
  height = 120,
  color = SERIES_COLOR,
  yMax,
  yMin,
}: {
  points: Array<{ x: string; y: number }>;
  height?: number;
  color?: string;
  yMax?: number;
  yMin?: number;
}) {
  if (points.length === 0) {
    return <ChartEmpty height={height} />;
  }
  const width = 600;
  const pad = 8;
  const max = yMax ?? Math.max(...points.map((p) => p.y), 1);
  const min = yMin ?? Math.min(...points.map((p) => p.y), 0);
  const span = max - min || 1;
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (p.y - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${coords[coords.length - 1]![0].toFixed(1)},${height - pad} L${coords[0]![0].toFixed(1)},${height - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
    >
      <path d={area} fill={color} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={color} />
      ))}
    </svg>
  );
}

export function Sparkline({ values, color = SERIES_COLOR }: { values: number[]; color?: string }) {
  if (values.length === 0) return null;
  const width = 100;
  const height = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const d = values
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${((1 - (v - min) / span) * height).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-24" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function BarList({
  items,
  colorFor,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  colorFor?: (label: string) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <ChartEmpty height={80} />;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="w-40 shrink-0 truncate text-sm text-slate-600 dark:text-slate-300"
            title={item.label}
          >
            {item.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: colorFor?.(item.label) ?? SERIES_COLOR,
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums">
            {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  segments,
  size = 140,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <ChartEmpty height={size} />;
  const radius = size / 2;
  const stroke = 18;
  const r = radius - stroke / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {segments.map((s) => {
            const len = (s.value / total) * circumference;
            const dash = `${len} ${circumference - len}`;
            const el = (
              <circle
                key={s.label}
                cx={radius}
                cy={radius}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900 text-lg font-semibold dark:fill-slate-100"
        >
          {total.toLocaleString()}
        </text>
      </svg>
      <ul className="space-y-1 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="capitalize text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const stroke = size <= 96 ? 10 : 12;
  const r = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped >= 90 ? '#10b981' : clamped >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-slate-100 dark:stroke-slate-800"
      />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        />
      </g>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className={`fill-slate-900 font-bold dark:fill-slate-100 ${size <= 96 ? 'text-xl' : 'text-2xl'}`}
      >
        {Math.round(clamped)}
      </text>
    </svg>
  );
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-800"
      style={{ height }}
    >
      No data yet
    </div>
  );
}

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#64748b',
  info: '#2563eb',
};
