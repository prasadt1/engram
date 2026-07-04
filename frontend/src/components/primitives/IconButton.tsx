import React from 'react';

type Variant = 'ghost' | 'filled' | 'primary';
type Size = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  /** Accessible name — used for aria-label + title. */
  label: string;
  variant?: Variant;
  size?: Size;
}

const DIMS: Record<Size, string> = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
const VARIANTS: Record<Variant, string> = {
  ghost: 'bg-transparent text-muted hover:text-white hover:bg-surface-3 border border-warm',
  filled: 'bg-surface-2 text-stone-200 hover:bg-surface-3 hover:text-white border border-warm',
  primary: 'bg-brand-500 hover:bg-brand-400 text-on-brand border border-transparent',
};

/** Square, icon-only control for toolbars and card corners. */
export const IconButton: React.FC<Props> = ({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...rest
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${DIMS[size]} ${VARIANTS[variant]} ${className}`}
    style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
    {...rest}
  >
    {icon}
  </button>
);
