import React from 'react';

interface Props {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** One-line topic between the figure and the note (e.g. recent assignment brief). */
  detail?: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
}

/** An "at a glance" metric tile — amber icon well, serif figure, one-line note. */
export const StatCard: React.FC<Props> = ({ icon, label, value, unit, detail, note, action, className = '' }) => (
  <div className={`flex items-start gap-4 bg-surface-1 border border-warm rounded-lg p-4 ${className}`}>
    {icon && (
      <div className="shrink-0 mt-0.5 p-2 rounded-md bg-surface-2 text-brand-400 inline-flex">{icon}</div>
    )}
    <div className="flex-1 min-w-0">
      <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="m-0 font-serif text-lg leading-tight text-white tabular-nums">
        {value}
        {unit && <span className="text-xs font-sans text-muted"> {unit}</span>}
      </p>
      {detail && (
        <p className="m-0 mt-1 text-sm font-serif text-white line-clamp-2 leading-snug">{detail}</p>
      )}
      {note && <p className="m-0 mt-0.5 text-xs text-muted">{note}</p>}
    </div>
    {action && <div className="shrink-0 self-center">{action}</div>}
  </div>
);
