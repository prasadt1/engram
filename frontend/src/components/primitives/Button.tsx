import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const SIZES: Record<Size, string> = {
  sm: 'text-[13px] px-3.5 py-2 rounded-md gap-1.5',
  md: 'text-sm px-5 py-2.5 rounded-md gap-2',
  lg: 'text-base px-6 py-3 rounded-lg gap-2',
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-400 text-on-brand border border-transparent',
  secondary: 'bg-transparent hover:bg-surface-2 text-stone-300 hover:text-white border border-warm',
  ghost: 'bg-transparent hover:bg-brand-500/10 text-brand-400 border border-brand-500',
  subtle: 'bg-transparent text-muted hover:text-white border border-transparent',
};

/** The primary action primitive. Press-scale + focus ring come from index.css globals. */
export const Button: React.FC<Props> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  className = '',
  children,
  ...rest
}) => (
  <button
    className={`inline-flex items-center justify-center font-semibold leading-none whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${SIZES[size]} ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
    {...rest}
  >
    {icon && <span className="inline-flex shrink-0">{icon}</span>}
    {children}
    {iconRight && <span className="inline-flex shrink-0">{iconRight}</span>}
  </button>
);
