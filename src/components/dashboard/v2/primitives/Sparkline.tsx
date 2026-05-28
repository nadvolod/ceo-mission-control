'use client';

type SparklineProps = {
  data: number[];
  color: string;
  fill?: string;
  height?: number;
  width?: number;
  strokeWidth?: number;
  dots?: boolean;
};

// Inline SVG sparkline — no deps. Renders a line over a translucent area fill.
// When `dots` is true, the last point is emphasized at 2px radius.
export function Sparkline({
  data,
  color,
  fill,
  height = 32,
  width = 232,
  strokeWidth = 1.5,
  dots = false,
}: SparklineProps) {
  if (!data.length) return <div style={{ height, width }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const fillPath = `${linePath} L ${(width).toFixed(2)} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      // Stretch to fill the parent container. The `width` attribute and
      // viewBox define the COORDINATE space; the CSS width here makes the
      // SVG element itself shrink/grow with the layout. Without this, fixed
      // pixel widths could overflow narrow cells (caught by Copilot).
      style={{ width: '100%', maxWidth: width, display: 'block' }}
      aria-hidden
    >
      {fill && (
        <path d={fillPath} fill={fill} opacity={0.18} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dots && points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 2 : 1}
          fill={color}
        />
      ))}
    </svg>
  );
}
