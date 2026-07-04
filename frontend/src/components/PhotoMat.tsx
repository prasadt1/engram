import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  /** Contact-sheet print margin feel */
  variant?: 'default' | 'contact';
  aspect?: string;
}

/**
 * Consistent photo matting — warm photo-black surround, inner shadow, editorial radius.
 */
export const PhotoMat: React.FC<Props> = ({
  children,
  className = '',
  variant = 'default',
  aspect,
}) => (
  <div
    className={`bg-photo-black overflow-hidden ${
      variant === 'contact'
        ? 'p-2 sm:p-3 border border-warm/80 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)]'
        : 'p-3 border border-warm ring-1 ring-warm/40 shadow-inner'
    } rounded-xl ${className}`}
  >
    <div
      className={`relative overflow-hidden rounded-lg ${aspect ?? ''}`}
      style={{ boxShadow: 'inset 0 0 24px rgba(0,0,0,0.45)' }}
    >
      {children}
    </div>
  </div>
);
