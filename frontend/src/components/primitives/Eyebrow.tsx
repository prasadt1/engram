import React from 'react';

type Tone = 'muted' | 'brand' | 'faint';

interface Props {
  children: React.ReactNode;
  tone?: Tone;
  as?: React.ElementType;
  className?: string;
}

const TONE: Record<Tone, string> = {
  muted: 'text-muted',
  brand: 'text-brand-400',
  faint: 'text-stone-500',
};

/** The uppercase, wide-tracked kicker above most headings/sections. */
export const Eyebrow: React.FC<Props> = ({ children, tone = 'muted', as: Tag = 'p', className = '' }) => (
  <Tag className={`m-0 text-[11px] font-semibold uppercase tracking-[0.12em] ${TONE[tone]} ${className}`}>
    {children}
  </Tag>
);
