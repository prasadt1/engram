import React from 'react';

type Variant = 'default' | 'brand' | 'outline';

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  icon?: React.ReactNode;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  default: 'bg-surface-2 text-stone-300 border border-transparent',
  brand: 'bg-brand-500/20 text-brand-400 border border-transparent',
  outline: 'bg-transparent text-muted border border-warm',
};

/** A small descriptor chip — aesthetic tags, dimension labels. */
export const Tag: React.FC<Props> = ({ children, variant = 'default', icon, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 text-xs font-medium leading-none px-2.5 py-1.5 rounded-md whitespace-nowrap ${VARIANTS[variant]} ${className}`}
  >
    {icon && <span className="inline-flex">{icon}</span>}
    {children}
  </span>
);
