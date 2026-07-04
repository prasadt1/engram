import React, { useEffect, useState } from 'react';

interface Props {
  /** Dimension name, e.g. "Composition". */
  label: string;
  /** Score for this dimension, 0..max. */
  value: number;
  /** Scale ceiling. Default 10. */
  max?: number;
  /** Position in a stack — staggers the fill animation. Default 0. */
  index?: number;
  /** Animate the fill from 0 (respects reduced-motion). Default true. */
  animate?: boolean;
  /** Show the serif numeral on the right. Default true. */
  showValue?: boolean;
  className?: string;
}

/**
 * DimensionBar — a single Glass Box dimension readout: label, serif score, and
 * an amber fill. Stack five (composition, lighting, focus, colour, story) for
 * the critique breakdown. The fill width is a committed state value, so even if
 * the tab is throttled it always lands at its final width — never stuck at 0.
 */
export const DimensionBar: React.FC<Props> = ({
  label,
  value,
  max = 10,
  index = 0,
  animate = true,
  showValue = true,
  className = '',
}) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const [w, setW] = useState(animate ? 0 : pct);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) {
      setW(pct);
      return;
    }
    const id = window.setTimeout(() => setW(pct), 80 + index * 110);
    return () => window.clearTimeout(id);
  }, [pct, index, animate]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] text-stone-300">{label}</span>
        {showValue && (
          <span className="font-serif text-[15px] text-white tabular-nums">
            {value.toFixed(1)}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-700"
          style={{ width: `${w}%`, transitionTimingFunction: 'var(--ease-out-expo)' }}
        />
      </div>
    </div>
  );
};
