import React from 'react';
import { Settings } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useLogoEntrance } from '../hooks/useLogoEntrance';
import type { AppTab } from '../config/navConfig';
import { sidebarNavItems } from '../config/navConfig';
import type { Assignment, UserMode } from '../types/practice';

export interface SidebarPhoto {
  id: string;
  imageUrl: string;
}

interface Props {
  activeTab: AppTab;
  mode: UserMode;
  onNavigate: (tab: AppTab) => void;
  photoCount: number;
  recentPhotos: SidebarPhoto[];
  trendDelta: number | null;
  mentorOneLiner: string | null;
  activeAssignment: Assignment | null;
  pendingOrganize: number;
  pendingPrintDrafts: number;
}

function NavBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400"
      title={label}
    >
      {label ? `${label} · ${count}` : count}
    </span>
  );
}

export const AppSidebar: React.FC<Props> = ({
  activeTab,
  mode,
  onNavigate,
  photoCount,
  recentPhotos,
  trendDelta,
  mentorOneLiner,
  activeAssignment,
  pendingOrganize,
  pendingPrintDrafts,
}) => {
  const items = sidebarNavItems(mode);
  const logoAnimate = useLogoEntrance();

  const showMentorFooter = Boolean(mentorOneLiner && photoCount > 0);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-52 shrink-0 border-r border-warm bg-canvas h-screen max-h-screen sticky top-0 z-10">
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="sidebar-logo-zone shrink-0 flex items-center p-4 text-left hover:bg-surface-1/50 transition-all duration-200 border-b border-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2"
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        <BrandLogo variant="horizontal" animate={logoAnimate} />
      </button>

      <nav
        className="shrink-0 px-2 py-3 space-y-1"
        aria-label="Main navigation"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const selected = activeTab === item.id;
          const practiceBadge = item.id === 'practice' && activeAssignment ? 1 : 0;
          const mentorBadge = item.id === 'mentor' ? pendingOrganize : 0;
          const printBadge = item.id === 'print' ? pendingPrintDrafts : 0;
          const badgeCount = practiceBadge || mentorBadge || printBadge;
          const badgeLabel =
            mentorBadge > 0 ? 'Organize' : printBadge > 0 ? 'Drafts' : undefined;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onNavigate(item.id)}
              className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
                selected
                  ? 'bg-brand-500/15 text-stone-100 border-l-2 border-brand-400 pl-2.5'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-surface-1/40'
              }`}
              style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
              <NavBadge count={badgeCount} label={badgeLabel} />
            </button>
          );
        })}
      </nav>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Portfolio glimpses */}
        <div className="px-3 py-4 border-t border-warm">
          {photoCount > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {recentPhotos.slice(0, 4).map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onNavigate('work')}
                    className="aspect-square rounded-md bg-surface-2 overflow-hidden hover:ring-1 hover:ring-brand-500/40"
                  >
                    <img src={photo.imageUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-400 mb-2">
                {photoCount} photo{photoCount === 1 ? '' : 's'}
              </p>
              {trendDelta != null && (
                <p
                  className={`text-xs tabular-nums ${
                    trendDelta > 0 ? 'text-green-400' : 'text-stone-400'
                  }`}
                >
                  {trendDelta > 0 ? '+' : ''}
                  {trendDelta.toFixed(1)} this month
                </p>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="w-full flex flex-col items-center justify-center py-4 border border-dashed border-warm rounded-lg hover:border-brand-500/40 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-stone-500 mb-2">
                +
              </div>
              <p className="text-xs text-stone-500 text-center px-2">Upload your first photo</p>
            </button>
          )}
        </div>

        {/* Contextual block — tab-specific actions only (not Home mentor copy; that lives in footer) */}
        {(activeTab === 'practice' && activeAssignment) ||
        (activeTab === 'mentor' && pendingOrganize > 0) ||
        (activeTab === 'print' && pendingPrintDrafts > 0) ? (
          <div className="px-3 pb-4">
            {activeTab === 'practice' && activeAssignment && (
              <div className="bg-surface-2 rounded-lg p-3 border border-warm">
                <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">
                  Active assignment
                </p>
                <p className="text-xs text-stone-300 line-clamp-3">{activeAssignment.brief}</p>
              </div>
            )}
            {activeTab === 'mentor' && pendingOrganize > 0 && (
              <div className="bg-surface-2 rounded-lg p-3 border border-warm">
                <p className="text-xs text-stone-300">Organize · {pendingOrganize} pending</p>
              </div>
            )}
            {activeTab === 'print' && pendingPrintDrafts > 0 && (
              <div className="bg-surface-2 rounded-lg p-3 border border-warm">
                <p className="text-xs text-stone-300">{pendingPrintDrafts} draft listing(s)</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-auto shrink-0 border-t border-warm bg-canvas">
        {showMentorFooter && (
          <div className="px-3 py-3">
            <p className="text-xs text-brand-400 leading-relaxed line-clamp-3">{mentorOneLiner}</p>
          </div>
        )}
        <div className={`p-2 ${showMentorFooter ? 'border-t border-warm' : ''}`}>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Account settings"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
              activeTab === 'settings'
                ? 'bg-surface-1 text-stone-200 border-l-2 border-brand-400 pl-2.5'
                : 'text-stone-400 hover:text-stone-300 hover:bg-surface-1/40'
            }`}
            style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
          >
            <Settings className="w-4 h-4" aria-hidden />
            Settings
          </button>
        </div>
      </div>
    </aside>
  );
};
