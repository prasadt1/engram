import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '../lib/theme';

interface Props {
  theme: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

export const ThemeToggle: React.FC<Props> = ({ theme, onChange }) => {
  const isLight = theme === 'light';

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-white">Appearance</p>
        <p className="text-xs text-muted mt-1">
          Warm darkroom default, or a lighter gallery for bright environments.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        onClick={() => onChange(isLight ? 'dark' : 'light')}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-warm bg-surface-2 text-sm text-stone-200 hover:bg-surface-3 transition-colors shrink-0"
      >
        {isLight ? (
          <>
            <Sun className="w-4 h-4 text-brand-400" aria-hidden />
            Light
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-brand-400" aria-hidden />
            Dark
          </>
        )}
      </button>
    </div>
  );
};
