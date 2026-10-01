import { OUTCOME_LABEL, buildRanges, type Chances, type OutcomeMixRow } from '@casino/shared';
import { useState, type ReactNode } from 'react';
import { cn } from '../lib/format';

/*
 * Hand-built SVG/HTML charts. Rules followed (dataviz method): thin marks
 * (≤24px) with 4px rounded data-ends on a single baseline, hairline recessive
 * grid, one hue for a single series, a legend for 2+ series, selective direct
 * labels, a per-mark hover/focus tooltip, and a table view for every chart.
 * Text uses text tokens, never the series colour.
 */

const SERIES = {
  1: 'var(--color-series-1)',
  2: 'var(--color-series-2)',
  3: 'var(--color-series-3)',
  4: 'var(--color-series-4)',
} as const;

function niceMax(value: number): number {
  if (value <= 0) return 5;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= value) return m * pow;
  return 10 * pow;
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="text-sm font-semibold text-gold-300 hover:text-gold-200">
      {open ? 'Show chart' : 'View as table'}
    </button>
  );
}

export function ChartCard({ title, subtitle, legend, children, table }: { title: string; subtitle?: string; legend?: ReactNode; children: ReactNode; table: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="glass rounded-2xl p-4 md:p-5" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      </div>
      {legend && !showTable && <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">{legend}</div>}
      {showTable ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

/** Single-series column chart (rounds per day). */
export function ColumnChart({ data, valueLabel }: { data: { label: string; short: string; value: number }[]; valueLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 36, r: 8, t: 16, b: 26 };
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const band = (W - pad.l - pad.r) / data.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const peak = data.reduce((best, d, i) => (d.value > data[best]!.value ? i : best), 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={`${valueLabel} per day`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.08)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-subtle)" className="tabular">
              {Math.round(t).toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + band * i + (band - barW) / 2;
          const top = y(d.value);
          const h = Math.max(0, y(0) - top);
          const r = Math.min(4, h);
          return (
            <g key={d.label}>
              {h > 0 && (
                <path
                  d={`M${x} ${y(0)} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${y(0)} Z`}
                  fill={SERIES[1]}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i === peak || i === data.length - 1) && d.value > 0 && (
                <text x={x + barW / 2} y={top - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-fg)">
                  {d.value}
                </text>
              )}
              {(i % 2 === data.length % 2 || data.length <= 7) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10.5} fill="var(--color-subtle)">
                  {d.short}
                </text>
              )}
              {/* Hit target: the whole column band, larger than the mark. */}
              <rect
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={H - pad.t - pad.b}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${d.value} ${valueLabel}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none focus-visible:stroke-gold-400"
              />
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="rgb(255 255 255 / 0.18)" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1.5 text-sm shadow-lg"
          style={{ left: `${((pad.l + (W - pad.l - pad.r) / data.length * (hover + 0.5)) / W) * 100}%` }}
        >
          <p className="tabular font-semibold text-fg">
            {data[hover]!.value} {valueLabel}
          </p>
          <p className="text-xs text-muted">{data[hover]!.label}</p>
        </div>
      )}
    </div>
  );
}

/** Target vs actual share per outcome — grouped horizontal bars, two series. */
export function OutcomeMixChart({ rows }: { rows: OutcomeMixRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(10, ...rows.flatMap((r) => [r.target, r.actual]));
  const scale = niceMax(max);
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.outcome} className="grid grid-cols-[88px_1fr] items-center gap-3">
          <span className="text-sm font-medium text-muted">{OUTCOME_LABEL[row.outcome]}</span>
          <div className="space-y-[2px]">
            {(
              [
                ['target', row.target, SERIES[1], 'Target'],
                ['actual', row.actual, SERIES[2], 'Actual'],
              ] as const
            ).map(([key, value, color, label]) => {
              const id = `${row.outcome}-${key}`;
              return (
                <div
                  key={key}
                  className="group relative flex h-[14px] items-center"
                  tabIndex={0}
                  role="img"
                  aria-label={`${OUTCOME_LABEL[row.outcome]} ${label.toLowerCase()}: ${value}%`}
                  onPointerEnter={() => setHover(id)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(id)}
                  onBlur={() => setHover(null)}
                >
                  <div
                    className={cn('h-[12px] rounded-r-[4px] transition-opacity', hover && hover !== id && 'opacity-60')}
                    style={{ width: `${(value / scale) * 100}%`, background: color, minWidth: value > 0 ? 2 : 0 }}
                  />
                  <span className="tabular ml-1.5 text-xs text-fg">{value}%</span>
                  {hover === id && (
                    <span className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1 text-sm shadow-lg">
                      <strong className="tabular text-fg">{value}%</strong> <span className="text-muted">{label} · {OUTCOME_LABEL[row.outcome]}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OutcomeMixLegend() {
  return (
    <>
      <LegendItem color={SERIES[1]} label="Target (probability engine)" />
      <LegendItem color={SERIES[2]} label="Actual (game result)" />
    </>
  );
}

export function OutcomeMixTable({ rows }: { rows: OutcomeMixRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-subtle">
          <th scope="col" className="py-2 pr-3 font-semibold">Outcome</th>
          <th scope="col" className="py-2 pr-3 text-right font-semibold">Target</th>
          <th scope="col" className="py-2 text-right font-semibold">Actual</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.outcome} className="border-b border-white/[0.05] last:border-0">
            <th scope="row" className="py-2 pr-3 text-left font-medium">{OUTCOME_LABEL[r.outcome]}</th>
            <td className="tabular py-2 pr-3 text-right">{r.target}%</td>
            <td className="tabular py-2 text-right">{r.actual}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The 0–100 number line split into outcome ranges (PRD §16), for the probability editor. */
export function RangeBar({ chances }: { chances: Chances }) {
  const ranges = buildRanges(chances);
  const colors = [SERIES[1], SERIES[2], SERIES[3], SERIES[4]];
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px] bg-white/[0.04]" aria-hidden>
        {ranges.map((r, i) =>
          r.to > r.from ? <div key={r.outcome} style={{ width: `${r.to - r.from}%`, background: colors[i] }} /> : null,
        )}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted">
        {ranges.map((r, i) => (
          <li key={r.outcome} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colors[i] }} aria-hidden />
            <span className="text-fg">{OUTCOME_LABEL[r.outcome]}</span>
            <span className="tabular">{r.to > r.from ? `${r.from}–${r.to}` : 'never'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
