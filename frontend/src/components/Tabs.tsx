import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TabItem {
  /** Stable id, matched against `value`. */
  id: string;
  /** Visible label. */
  label: string;
  /** Optional leading icon (amber when active). */
  icon?: React.ReactNode;
}

interface Props {
  tabs: TabItem[];
  /** Active tab id (controlled). Omit for uncontrolled. */
  value?: string;
  onChange?: (id: string) => void;
  /** The active panel — re-enters (rises) when `value` changes. Optional. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Tabs — an underline tab strip with a sliding amber indicator and a panel that
 * rises and settles on change. Controlled (value + onChange) or uncontrolled.
 * The top-level app nav already lives in AppSidebar/BottomNav — use this for
 * SUB-VIEW switching inside a tab. The indicator is measured and committed on
 * every change so it always lands under the active tab; the panel's entrance is
 * transform-only (opacity pinned to 1) so it can never strand invisible.
 */
export const Tabs: React.FC<Props> = ({ tabs, value, onChange, children, className = '' }) => {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(tabs[0]?.id);
  const active = controlled ? value : internal;
  const setActive = (id: string) => {
    if (!controlled) setInternal(id);
    onChange?.(id);
  };

  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = active ? btnRefs.current[active] : null;
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, tabs.length]);

  return (
    <div className={className}>
      <div role="tablist" className="relative flex gap-1 border-b border-warm">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                btnRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm whitespace-nowrap ${
                selected ? 'font-semibold text-white' : 'font-medium text-muted hover:text-stone-300'
              }`}
            >
              {t.icon && <span className={selected ? 'text-brand-400' : ''}>{t.icon}</span>}
              {t.label}
            </button>
          );
        })}
        <span
          aria-hidden
          className="absolute -bottom-px left-0 h-0.5 rounded-t bg-brand-500"
          style={{
            width: ind.width,
            transform: `translateX(${ind.left}px)`,
            transition: 'transform 0.28s var(--ease-out-expo), width 0.28s var(--ease-out-expo)',
          }}
        />
      </div>
      {children != null && active != null && <TabPanel id={active}>{children}</TabPanel>}
    </div>
  );
};

const TabPanel: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(true);
      return;
    }
    const t = window.setTimeout(() => setShown(true), 10);
    return () => window.clearTimeout(t);
  }, [id]);
  return (
    <div
      role="tabpanel"
      className="pt-5"
      style={{
        transform: shown ? 'translateY(0)' : 'translateY(6px)',
        transition: 'transform 0.28s var(--ease-out-expo)',
      }}
    >
      {children}
    </div>
  );
};
