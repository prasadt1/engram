import React from 'react';
import { FlaskConical, Settings, ArrowRight, Users } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { InfoTooltip } from './primitives/InfoTooltip';
import { getDimensionMeaning } from '../lib/scoreContext';
import { useLogoEntrance } from '../hooks/useLogoEntrance';
import type { SidebarFocusDisplay } from '../lib/coachingBrief';
import type { AppTab } from '../config/navConfig';
import { sidebarNavItems } from '../config/navConfig';
import type { Assignment, UserMode } from '../types/practice';

interface Props {
  activeTab: AppTab;
  mode: UserMode;
  onNavigate: (tab: AppTab) => void;
  /** True while the Glass box (#glassbox) evidence page is shown. It lives
   * outside the AppTab union (see App.tsx's showGlassBox), so the sidebar
   * needs its own flag to select the Proof entry and deselect the tabs. */
  glassBoxActive: boolean;
  onNavigateGlassBox: () => void;
  coachAssistActive?: boolean;
  onNavigateCoachAssist?: () => void;
  showCoachAssistLink?: boolean;
  photoCount: number;
  focusDisplay: SidebarFocusDisplay | null;
  nextShotBrief: string | null;
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
  glassBoxActive,
  onNavigateGlassBox,
  coachAssistActive = false,
  onNavigateCoachAssist,
  showCoachAssistLink = false,
  photoCount,
  focusDisplay,
  nextShotBrief,
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
        className="sidebar-logo-zone shrink-0 flex items-center justify-center gap-2 py-4 px-4 text-left hover:bg-surface-1/50 transition-all duration-200 border-b border-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2"
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        <BrandLogo variant="horizontal" size={22} markSize={40} animate={logoAnimate} />
      </button>

      <nav
        className="shrink-0 px-2 py-3 space-y-1"
        aria-label="Main navigation"
      >
        {items.map((item) => {
          const Icon = item.icon;
          // While the Glass box page is up, the underlying activeTab is
          // preserved (so navigating back restores it) but must not read as
          // selected — only the Proof entry below is.
          const selected = !glassBoxActive && !coachAssistActive && activeTab === item.id;
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
              data-tour={
                item.id === 'work' ? 'nav-work' : item.id === 'practice' ? 'nav-practice' : undefined
              }
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

        {/* Proof group — the judge-facing evidence section. Deliberately a
            separate group under an eyebrow, not another AppTab: the Glass
            box is the receipts behind the product (live stats + committed
            benchmark), and it should be findable without scrolling to the
            footer link (which also still works). */}
        <div className="pt-3 mt-2 border-t border-warm">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            Proof
          </p>
          <button
            type="button"
            role="tab"
            aria-selected={glassBoxActive}
            onClick={onNavigateGlassBox}
            data-tour="nav-proof"
            className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
              glassBoxActive
                ? 'bg-brand-500/15 text-stone-100 border-l-2 border-brand-400 pl-2.5'
                : 'text-stone-400 hover:text-stone-200 hover:bg-surface-1/40'
            }`}
            style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
          >
            <FlaskConical className="w-4.5 h-4.5 shrink-0" aria-hidden />
            <span className="truncate">Memory Proof Room</span>
          </button>
          {showCoachAssistLink && onNavigateCoachAssist && (
            <button
              type="button"
              role="tab"
              aria-selected={coachAssistActive}
              onClick={onNavigateCoachAssist}
              className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
                coachAssistActive
                  ? 'bg-brand-500/15 text-stone-100 border-l-2 border-brand-400 pl-2.5'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-surface-1/40'
              }`}
              style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
            >
              <Users className="w-4.5 h-4.5 shrink-0" aria-hidden />
              <span className="truncate">Coach Assist</span>
            </button>
          )}
        </div>
      </nav>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="px-3 py-4 border-t border-warm space-y-3">
          {photoCount > 0 ? (
            <>
              <p className="text-xs text-stone-400">
                {photoCount} photo{photoCount === 1 ? '' : 's'} in your library
              </p>

              {focusDisplay && (
                <div className="bg-surface-2 rounded-lg p-3 border border-brand-500/25">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400/90 mb-1">
                    Current focus
                  </p>
                  <p className="text-sm font-medium text-stone-100 inline-flex items-center gap-1">
                    {focusDisplay.skillLabel}
                    {getDimensionMeaning(focusDisplay.skillLabel) && (
                      <InfoTooltip
                        text={getDimensionMeaning(focusDisplay.skillLabel)!}
                        label={`What ${focusDisplay.skillLabel} means`}
                      />
                    )}
                  </p>
                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">{focusDisplay.detail}</p>
                </div>
              )}

              {nextShotBrief && (
                <div className="bg-surface-2 rounded-lg p-3 border border-brand-500/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400/90 mb-1.5">
                    Next shot brief
                  </p>
                  <p className="text-xs text-stone-300 leading-relaxed">{nextShotBrief}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => onNavigate('work')}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-surface-2/60 transition-colors"
              >
                Open latest critique
                <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
              </button>
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
            <p className="text-[13px] text-stone-300 leading-relaxed line-clamp-3">{mentorOneLiner}</p>
          </div>
        )}
        <div className={`p-2 ${showMentorFooter ? 'border-t border-warm' : ''}`}>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Account settings"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
              activeTab === 'settings' && !glassBoxActive && !coachAssistActive
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
