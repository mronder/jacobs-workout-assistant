import type { ProgressionPoint } from '../services/history';

interface ProgressChartProps {
  data: ProgressionPoint[];
}

/**
 * Custom SVG line chart for exercise weight progression.
 * Zero dependencies — just SVG.
 */
export default function ProgressChart({ data }: ProgressChartProps) {
  if (data.length < 2) {
    return (
      <div className="bg-surface-1 rounded-xl p-6 text-center shadow-card">
        <p className="text-zinc-500 text-sm">
          {data.length === 1
            ? 'Need at least 2 sessions to show a chart.'
            : 'No data yet.'}
        </p>
      </div>
    );
  }

  const W = 320;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const weights = data.map((d) => d.maxWeight);
  const minW = Math.floor(Math.min(...weights) * 0.9);
  const maxW = Math.ceil(Math.max(...weights) * 1.05) || 1;
  const avgW = weights.reduce((a, b) => a + b, 0) / weights.length;

  const scaleX = (i: number) => PAD.left + (i / (data.length - 1)) * chartW;
  const scaleY = (w: number) =>
    PAD.top + chartH - ((w - minW) / (maxW - minW || 1)) * chartH;

  const points = data.map((d, i) => ({ x: scaleX(i), y: scaleY(d.maxWeight) }));

  // Smooth cubic bezier path
  const getSmooth = (pts: { x: number; y: number }[]): string => {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const linePath = getSmooth(points);
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + chartH} L${points[0].x},${PAD.top + chartH} Z`;

  // Y-axis ticks
  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round(minW + ((maxW - minW) / yTicks) * i),
  );

  // X-axis labels (show first, middle, last)
  const xLabels =
    data.length <= 5
      ? data.map((d, i) => ({ idx: i, label: formatDate(d.date) }))
      : [
          { idx: 0, label: formatDate(data[0].date) },
          { idx: Math.floor(data.length / 2), label: formatDate(data[Math.floor(data.length / 2)].date) },
          { idx: data.length - 1, label: formatDate(data[data.length - 1].date) },
        ];

  return (
    <div className="bg-surface-1 rounded-xl p-4 shadow-card">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">
        Weight Progression
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTickVals.map((v) => (
          <line
            key={v}
            x1={PAD.left}
            y1={scaleY(v)}
            x2={W - PAD.right}
            y2={scaleY(v)}
            stroke="#1a1a1a"
            strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {yTickVals.map((v) => (
          <text
            key={`label-${v}`}
            x={PAD.left - 6}
            y={scaleY(v) + 3}
            textAnchor="end"
            fill="#52525b"
            fontSize={9}
            fontFamily="inherit"
          >
            {v}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l) => (
          <text
            key={l.idx}
            x={scaleX(l.idx)}
            y={H - 4}
            textAnchor="middle"
            fill="#52525b"
            fontSize={8}
            fontFamily="inherit"
          >
            {l.label}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" opacity={0.3} />

        {/* Average reference line */}
        <line
          x1={PAD.left}
          y1={scaleY(avgW)}
          x2={W - PAD.right}
          y2={scaleY(avgW)}
          stroke="#f97316"
          strokeWidth={0.5}
          strokeDasharray="4 3"
          opacity={0.4}
        />
        <text
          x={W - PAD.right + 2}
          y={scaleY(avgW) + 3}
          fill="#f97316"
          fontSize={7}
          opacity={0.5}
        >
          avg
        </text>

        {/* Line */}
        <path d={linePath} fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#f97316" stroke="#0a0a0a" strokeWidth={2} />
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
