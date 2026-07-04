import React from 'react';
import type { AppTab } from '../config/navConfig';
import { bottomNavItems } from '../config/navConfig';
import type { UserMode } from '../types/practice';

interface Props {
  activeTab: AppTab;
  mode: UserMode;
  onNavigate: (tab: AppTab) => void;
}

export const BottomNav: React.FC<Props> = ({ activeTab, mode, onNavigate }) => {
  const items = bottomNavItems(mode);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-warm bg-canvas/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex justify-around items-stretch h-16 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = activeTab === item.id;
          const shortLabel = item.id === 'work' ? 'Work' : item.label.split(' ').pop();
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={item.label}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
                selected ? 'text-brand-400' : 'text-muted hover:text-stone-300'
              }`}
              style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
            >
              <Icon className="w-5 h-5" aria-hidden />
              <span>{shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
