/**
 * Tiny inline trend line for KPI cards. Pure SVG (no Recharts) so it renders
 * in server components with zero client JS. Scales the series to fit; a flat
 * series draws a midline.
 */
export function Sparkline({
  values,
  color = '#64748B',
  width = 96,
  height = 28,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const pad = 2; // keep the stroke inside the viewBox
  const step = (width - pad * 2) / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = range === 0
        ? height / 2
        : pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const [lastX, lastY] = points.split(' ').pop()!.split(',');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
