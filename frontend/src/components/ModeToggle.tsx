import React, { useState } from 'react';
import type { UserMode } from '../types/practice';

interface Props {
  mode: UserMode;
  onModeChange: (mode: UserMode) => void;
  onPersistPersona?: (mode: UserMode) => Promise<void>;
  onPersistError?: (message: string) => void;
}

export const ModeToggle: React.FC<Props> = ({
  mode,
  onModeChange,
  onPersistPersona,
  onPersistError,
}) => {
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: UserMode) => {
    onModeChange(next);
    if (!onPersistPersona) return;
    setSaving(true);
    try {
      await onPersistPersona(next);
    } catch (e) {
      onPersistError?.(
        e instanceof Error ? e.message : 'Could not save your profile mode',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-3 flex flex-wrap items-center gap-4">
      <span className="text-xs font-semibold text-muted uppercase tracking-wide">
        I&apos;m here as a
      </span>
      <div
        className="flex p-1 bg-surface-2 rounded-lg border border-warm"
        role="group"
        aria-label="Photographer profile mode"
      >
        {(
          [
            { id: 'hobbyist' as const, label: 'Hobbyist' },
            { id: 'working_pro' as const, label: 'Working pro' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => void handleChange(m.id)}
            disabled={saving}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === m.id
                ? 'bg-brand-500 text-on-brand'
                : 'text-muted hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        {saving
          ? 'Saving your mode…'
          : 'Working pro unlocks print listing drafts. Everything else stays in sync.'}
      </p>
    </div>
  );
};
