import React, { useId } from 'react';
import { Info } from 'lucide-react';

interface Props {
  /** Tooltip body — shown on hover and keyboard focus. */
  text: string;
  /** Accessible label for the trigger, e.g. "What Technique means". */
  label: string;
  className?: string;
}

/**
 * InfoTooltip — a tiny "ⓘ" affordance that reveals a short definition on hover
 * or keyboard focus. CSS-only reveal (group-hover / focus-within), no library.
 * The popover is `aria-describedby`-linked to the trigger and marked
 * role="tooltip" so screen readers announce it; it's non-interactive so it
 * never traps focus.
 */
export const InfoTooltip: React.FC<Props> = ({ text, label, className = '' }) => {
  const id = useId();
  return (
    <span className={`relative inline-flex group/tip align-middle ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex items-center justify-center text-stone-500 hover:text-brand-400 focus-visible:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 rounded-full transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Info className="w-3.5 h-3.5" aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-warm bg-surface-1 px-3 py-2 text-xs leading-relaxed text-stone-300 shadow-xl opacity-0 translate-y-1 transition-all duration-150 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0"
      >
        {text}
      </span>
    </span>
  );
};

export default InfoTooltip;
