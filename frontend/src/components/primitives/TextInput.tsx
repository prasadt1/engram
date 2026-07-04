import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: boolean;
}

/** Warm-well text field with an amber focus ring. */
export const TextInput: React.FC<Props> = ({ icon, error = false, className = '', disabled, ...rest }) => (
  <div
    className={`flex items-center gap-2 bg-surface-2 rounded-md px-3 border transition-[border-color,box-shadow] ${
      error
        ? 'border-rose-500/30'
        : 'border-warm focus-within:border-brand-400 focus-within:ring-[3px] focus-within:ring-brand-500/15'
    } ${disabled ? 'opacity-50' : ''} ${className}`}
    style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
  >
    {icon && <span className="inline-flex shrink-0 text-muted">{icon}</span>}
    <input
      disabled={disabled}
      className="flex-1 min-w-0 bg-transparent border-none outline-none py-2.5 text-sm text-stone-200 placeholder:text-stone-500"
      {...rest}
    />
  </div>
);
