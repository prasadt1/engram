import React, { useEffect, useState } from 'react';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  score: number | string;
  max?: number;
  size?: Size;
  /** Count up from 0 on mount (numeric scores only). Default true. */
  animate?: boolean;
  className?: string;
}

const SIZES: Record<Size, { num: string; pad: string; slash: string }> = {
  sm: { num: 'text-base', pad: 'px-2 py-0.5', slash: 'text-[10px]' },
  md: { num: 'text-2xl', pad: 'px-3.5 py-1.5', slash: 'text-xs' },
  lg: { num: 'text-4xl', pad: 'px-5 py-2', slash: 'text-sm' },
};

/**
 * The signature amber score pill — serif numeral over "/ 10". The count-up
 * initialises to the final value and is forced final by a setTimeout, so it
 * never strands mid-animation.
 */
export const ScoreBadge: React.FC<Props> = ({ score, max = 10, size = 'md', animate = true, className = '' }) => {
  const numeric = typeof score === 'number';
  const s = SIZES[size];
  const [shown, setShown] = useState<number | string>(score);

  useEffect(() => {
    if (!numeric || !animate) { setShown(score); return; }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(score); return; }
    const dur = 850;
    let raf = 0;
    let start = 0;
    setShown(0);
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setShown((score as number) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const safety = window.setTimeout(() => setShown(score), dur + 250);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(safety); };
  }, [score, animate, numeric]);

  const label = numeric ? (shown as number).toFixed(1) : score;
  return (
    <span
      className={`inline-flex items-baseline gap-1 bg-brand-500 text-on-brand rounded-full shadow-md whitespace-nowrap ${s.pad} ${className}`}
    >
      <span className={`font-serif font-bold tabular-nums leading-none ${s.num}`}>{label}</span>
      <span className={`font-semibold opacity-70 ${s.slash}`}>/ {max}</span>
    </span>
  );
};
