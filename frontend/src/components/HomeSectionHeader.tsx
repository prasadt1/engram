/**
 * Shared Home section header — eyebrow + serif title + one-line sub (Memory Threads pattern).
 */

import React from 'react';
import { Eyebrow } from './primitives';

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
  tone?: 'brand' | 'faint' | 'muted';
  className?: string;
}

export const HomeSectionHeader: React.FC<Props> = ({
  eyebrow,
  title,
  subtitle,
  tone = 'brand',
  className = '',
}) => (
  <header className={`mb-4 ${className}`}>
    <Eyebrow tone={tone} className="mb-1">
      {eyebrow}
    </Eyebrow>
    <h2 className="font-serif text-xl md:text-2xl text-white leading-snug">{title}</h2>
    {subtitle && <p className="text-sm text-stone-400 mt-1 max-w-2xl">{subtitle}</p>}
  </header>
);

export default HomeSectionHeader;
