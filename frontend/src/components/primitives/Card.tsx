import React from 'react';

type Variant = 'default' | 'elevated' | 'proposed' | 'active';
type Padding = 'none' | 'sm' | 'md' | 'lg';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  interactive?: boolean;
}

const PAD: Record<Padding, string> = { none: 'p-0', sm: 'p-4', md: 'p-5', lg: 'p-6' };
const VARIANTS: Record<Variant, string> = {
  default: 'bg-surface-1 border border-warm',
  elevated: 'bg-canvas-elevated border border-warm shadow-md',
  proposed: 'bg-surface-1 border-2 border-brand-500/40',
  active: 'bg-surface-1 border border-brand-500/50',
};

/**
 * The warm gallery container. `proposed`/`active` are the amber-edged HITL
 * states. Set `interactive` for a hover lift on clickable cards.
 */
export const Card = React.forwardRef<HTMLDivElement, Props>(function Card(
  {
    variant = 'default',
    padding = 'md',
    interactive = false,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rounded-xl ${PAD[padding]} ${VARIANTS[variant]} ${
        interactive
          ? 'cursor-pointer transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-500/40'
          : ''
      } ${className}`}
      style={interactive ? { transitionTimingFunction: 'var(--ease-out-expo)' } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
});
