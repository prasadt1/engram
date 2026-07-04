import { useEffect, useState } from 'react';

/**
 * Iris mark — bold aperture-eye (camera iris + human iris).
 * 6 windmill blades + iris ring + dark pupil with amber catchlight (the "eye").
 * Pass `animate` for a one-time focus-spin on mount (transform only, reduced-motion safe).
 */
export function IrisMark({
  size = 40,
  color = '#f5a623',
  pupilRim = '#fbbf24',
  extraBold = false,
  animate = false,
  className = '',
}: {
  size?: number;
  color?: string;
  pupilRim?: string;
  extraBold?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const cfg = extraBold
    ? { bW: 4.6, rW: 3.6, pR: 14, Rc: 26, cl: 4.6 }
    : { bW: 3.8, rW: 3.0, pR: 12.5, Rc: 25, cl: 4.2 };
  const R1 = 46;
  const C = 50;
  const t = Math.sqrt(R1 * R1 - cfg.Rc * cfg.Rc);

  const blades = Array.from({ length: 6 }, (_, i) => {
    const phi = ((60 * i) * Math.PI) / 180;
    const px = C + cfg.Rc * Math.cos(phi);
    const py = C + cfg.Rc * Math.sin(phi);
    const dx = -Math.sin(phi);
    const dy = Math.cos(phi);
    return { x1: px, y1: py, x2: px + t * dx, y2: py + t * dy };
  });

  const [settled, setSettled] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSettled(true);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Iris"
    >
      <g
        style={{
          transformOrigin: '50% 50%',
          transform: settled ? 'rotate(0deg) scale(1)' : 'rotate(-35deg) scale(0.92)',
          transition: 'transform 620ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <circle cx={C} cy={C} r={R1} stroke={color} strokeWidth={cfg.rW} />
        {blades.map((b, i) => (
          <line
            key={i}
            x1={b.x1}
            y1={b.y1}
            x2={b.x2}
            y2={b.y2}
            stroke={color}
            strokeWidth={cfg.bW}
            strokeLinecap="round"
          />
        ))}
        <circle cx={C} cy={C} r={cfg.Rc} stroke={color} strokeWidth={cfg.bW} />
        <circle
          cx={C}
          cy={C}
          r={cfg.pR}
          fill="#1a1816"
          stroke={pupilRim}
          strokeWidth={cfg.bW * 0.8}
        />
        <circle
          cx={C - cfg.pR * 0.32}
          cy={C - cfg.pR * 0.32}
          r={cfg.cl}
          fill={pupilRim}
        />
      </g>
    </svg>
  );
}
