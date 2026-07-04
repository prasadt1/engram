import React from 'react';

interface Props {
  values: number[];
  max?: number;
  min?: number;
  width?: number;
  height?: number;
  className?: string;
  'aria-label'?: string;
}

/** SVG sparkline for 0–10 score series (oldest → newest). */
export const MiniSparkline: React.FC<Props> = ({
  values,
  max = 10,
  min = 0,
  width = 72,
  height = 28,
  className = '',
  'aria-label': ariaLabel,
}) => {
  if (values.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden={!ariaLabel}
        aria-label={ariaLabel}
      />
    );
  }

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = pad + (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w);
    const y = pad + h - ((Math.min(max, Math.max(min, v)) - min) / range) * h;
    return `${x},${y}`;
  });

  const last = values[values.length - 1];
  const lastX = pad + (values.length === 1 ? w / 2 : w);
  const lastY = pad + h - ((Math.min(max, Math.max(min, last)) - min) / range) * h;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel ?? `Score trend across ${values.length} uploads`}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(' ')}
        className="text-brand-400/80"
      />
      <circle cx={lastX} cy={lastY} r="2.5" className="fill-brand-400" />
    </svg>
  );
};
