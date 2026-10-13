// Small hand-rolled SVG charts for the research dashboard.
// Specs: bars <= 24px thick with 4px rounded data-ends and square baselines, 2px surface gap between
// stacked segments, recessive grid, hover/focus tooltip on every mark, a table view under each chart.
import { useEffect, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Tip = { x: number; y: number; body: ReactNode } | null;
function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const show = (x: number, y: number, body: ReactNode) => setTip({ x, y, body });
  const hide = () => setTip(null);
  const el = tip && (
    <div className="viz-tip" role="status" style={{ left: tip.x, top: tip.y }}>
      {tip.body}
    </div>
  );
  return { show, hide, el };
}

/** Rect with a rounded right end (horizontal bars) or rounded top (columns). */
const hBar = (x: number, y: number, w: number, h: number, r = 4) => {
  const rr = Math.min(r, w, h / 2);
  if (w <= 0) return '';
  return `M${x},${y}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - 2 * rr}a${rr},${rr} 0 0 1 ${-rr},${rr}h${-(w - rr)}z`;
};
const vBar = (x: number, yBase: number, w: number, h: number, r = 4) => {
  const rr = Math.min(r, h, w / 2);
  if (h <= 0) return '';
  return `M${x},${yBase}v${-(h - rr)}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - rr}z`;
};

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function ChartCard({ title, subtitle, children, table }: { title: string; subtitle?: string; children: ReactNode; table?: ReactNode }) {
  return (
    <section className="card viz-card">
      <h2 className="viz-title">{title}</h2>
      {subtitle && <p className="viz-sub">{subtitle}</p>}
      {children}
      {table && (
        <details className="viz-table">
          <summary>Tabelle / Table</summary>
          {table}
        </details>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ columns over time
export function Columns({ data, label, valueLabel }: { data: { x: string; xLabel: string; value: number }[]; label: string; valueLabel: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const H = 180, padL = 28, padB = 22, padT = 8;
  const plotW = width - padL - 4, plotH = H - padB - padT;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const band = plotW / Math.max(1, data.length);
  const bw = Math.min(24, Math.max(3, band - 4));
  const ticks = [0, max / 2, max];
  const every = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));
  return (
    <div ref={ref} className="viz-wrap">
      <svg width={width} height={H} role="img" aria-label={label}>
        {ticks.map((t) => {
          const y = padT + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={width - 4} y1={y} y2={y} className={t === 0 ? 'viz-base' : 'viz-grid'} />
              <text x={padL - 6} y={y + 4} className="viz-axis" textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = padL + i * band + (band - bw) / 2;
          const h = (d.value / max) * plotH;
          return (
            <g key={d.x}>
              <path d={vBar(x, padT + plotH, bw, h)} className="viz-s1" />
              {i % every === 0 && <text x={x + bw / 2} y={H - 6} className="viz-axis" textAnchor="middle">{d.xLabel}</text>}
              <rect
                x={padL + i * band} y={padT} width={band} height={plotH} fill="transparent" tabIndex={0}
                aria-label={`${d.xLabel}: ${valueLabel(d.value)}`}
                onMouseEnter={() => tip.show(Math.min(x, width - 150), padT, <><strong>{d.xLabel}</strong><br />{valueLabel(d.value)}</>)}
                onFocus={() => tip.show(Math.min(x, width - 150), padT, <><strong>{d.xLabel}</strong><br />{valueLabel(d.value)}</>)}
                onMouseLeave={tip.hide} onBlur={tip.hide}
              />
            </g>
          );
        })}
      </svg>
      {tip.el}
    </div>
  );
}

// ------------------------------------------------------------------ horizontal bars (label above each bar)
export function HBars({ rows, max, label }: { rows: { key: string; label: string; value: number; valueText: string; tip: ReactNode }[]; max?: number; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const rowH = 44, bh = 16, valueW = 64;
  const m = niceMax(max ?? Math.max(0.0001, ...rows.map((r) => r.value)));
  const plotW = width - valueW;
  const H = rows.length * rowH;
  return (
    <div ref={ref} className="viz-wrap">
      <svg width={width} height={H} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const y = i * rowH;
          const w = (r.value / m) * plotW;
          return (
            <g key={r.key}>
              <text x={0} y={y + 14} className="viz-label">{r.label}</text>
              <path d={hBar(0, y + 20, w, bh)} className="viz-s1" />
              <text x={Math.max(w, 0) + 6} y={y + 32} className="viz-value">{r.valueText}</text>
              <rect
                x={0} y={y} width={width} height={rowH} fill="transparent" tabIndex={0} aria-label={`${r.label}: ${r.valueText}`}
                onMouseEnter={() => tip.show(Math.min(w, width - 170), y + 40, r.tip)} onFocus={() => tip.show(Math.min(w, width - 170), y + 40, r.tip)}
                onMouseLeave={tip.hide} onBlur={tip.hide}
              />
            </g>
          );
        })}
      </svg>
      {tip.el}
    </div>
  );
}

// ------------------------------------------------------------------ stacked horizontal bars, two parts of a whole
export function StackedHBars({ rows, aName, bName, label }: { rows: { key: string; label: string; a: number; b: number }[]; aName: string; bName: string; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const rowH = 44, bh = 16, valueW = 48, gap = 2;
  const m = niceMax(Math.max(1, ...rows.map((r) => r.a + r.b)));
  const plotW = width - valueW;
  const H = rows.length * rowH;
  return (
    <div ref={ref} className="viz-wrap">
      <div className="viz-legend" aria-hidden="true">
        <span><i className="viz-key viz-k1" />{aName}</span>
        <span><i className="viz-key viz-k2" />{bName}</span>
      </div>
      <svg width={width} height={H} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const y = i * rowH;
          const wa = (r.a / m) * plotW;
          const wb = (r.b / m) * plotW;
          const body = <><strong>{r.label}</strong><br />{aName}: {r.a}<br />{bName}: {r.b}</>;
          return (
            <g key={r.key}>
              <text x={0} y={y + 14} className="viz-label">{r.label}</text>
              {r.b > 0 ? (
                <>
                  {wa > 0 && <rect x={0} y={y + 20} width={wa} height={bh} className="viz-s1" />}
                  <path d={hBar(wa > 0 ? wa + gap : 0, y + 20, Math.max(wb - (wa > 0 ? gap : 0), 1), bh)} className="viz-s2" />
                </>
              ) : (
                <path d={hBar(0, y + 20, wa, bh)} className="viz-s1" />
              )}
              <text x={wa + wb + 6} y={y + 32} className="viz-value">{r.a + r.b}</text>
              <rect
                x={0} y={y} width={width} height={rowH} fill="transparent" tabIndex={0} aria-label={`${r.label}: ${aName} ${r.a}, ${bName} ${r.b}`}
                onMouseEnter={() => tip.show(Math.min(wa + wb, width - 150), y + 40, body)} onFocus={() => tip.show(Math.min(wa + wb, width - 150), y + 40, body)}
                onMouseLeave={tip.hide} onBlur={tip.hide}
              />
            </g>
          );
        })}
      </svg>
      {tip.el}
    </div>
  );
}

// ------------------------------------------------------------------ dot on a 1..5 scale
export function DotScale({ rows, label, lowText, highText }: { rows: { key: string; label: string; mean: number | null; n: number }[]; label: string; lowText: string; highText: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const rowH = 40, valueW = 44, padX = 8;
  const plotW = width - valueW - padX * 2;
  const xOf = (v: number) => padX + 6 + ((v - 1) / 4) * (plotW - 12);
  const H = rows.length * rowH + 22;
  return (
    <div ref={ref} className="viz-wrap">
      <svg width={width} height={H} role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((v) => (
          <text key={v} x={xOf(v)} y={H - 6} className="viz-axis" textAnchor="middle">{v}</text>
        ))}
        {rows.map((r, i) => {
          const y = i * rowH;
          const body = <><strong>{r.label}</strong><br />{r.mean === null ? '–' : `Ø ${r.mean.toFixed(2)}`} (n = {r.n})</>;
          return (
            <g key={r.key}>
              <text x={padX} y={y + 13} className="viz-label">{r.label}</text>
              <line x1={xOf(1)} x2={xOf(5)} y1={y + 27} y2={y + 27} className="viz-track" />
              {[1, 2, 3, 4, 5].map((v) => <line key={v} x1={xOf(v)} x2={xOf(v)} y1={y + 23} y2={y + 31} className="viz-grid" />)}
              {r.mean !== null && <circle cx={xOf(r.mean)} cy={y + 27} r={6} className="viz-dot" />}
              <text x={width - valueW + 6} y={y + 31} className="viz-value">{r.mean === null ? '–' : r.mean.toFixed(1)}</text>
              <rect
                x={0} y={y} width={width} height={rowH} fill="transparent" tabIndex={0} aria-label={`${r.label}: ${r.mean === null ? 'no data' : r.mean.toFixed(2)}`}
                onMouseEnter={() => tip.show(r.mean === null ? padX : Math.min(xOf(r.mean), width - 170), y + 36, body)}
                onFocus={() => tip.show(r.mean === null ? padX : Math.min(xOf(r.mean), width - 170), y + 36, body)}
                onMouseLeave={tip.hide} onBlur={tip.hide}
              />
            </g>
          );
        })}
      </svg>
      <p className="viz-scale-note">1 = {lowText} · 5 = {highText}</p>
      {tip.el}
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
