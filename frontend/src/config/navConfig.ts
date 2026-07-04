import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Images,
  Target,
  MessageCircle,
  Store,
} from 'lucide-react';
import type { UserMode } from '../types/practice';
import { FEATURES } from './features';

/**
 * Navigation structure (v2 — photo-first restructure)
 *
 * Consolidated from 8 tabs to 5:
 * - home: Photo-first dashboard with progress + assignment context
 * - work: Merged Studio + Memory (upload + gallery)
 * - practice: Merged Practice + Field (assignments + capture) — deferred
 *   in this build (FEATURES.practice=false, see ./features.ts): no
 *   backend routes for /api/v1/assignments* exist yet. `AppTab` keeps the
 *   'practice' member so legacy hash routing and App.tsx's switch stay
 *   simple; the gate lives entirely in which nav items are offered and in
 *   tabFromHash() falling back away from it.
 * - mentor: Merged Mentor + Triage (AI chat + batch labeling)
 * - print: Pro-only print sales
 * - settings: App settings
 */

export type AppTab = 'home' | 'work' | 'practice' | 'mentor' | 'print' | 'settings';

export interface NavItem {
  id: AppTab;
  label: string;
  icon: LucideIcon;
}

const HOME: NavItem = { id: 'home', label: 'Home', icon: Home };
const WORK: NavItem = { id: 'work', label: 'My Work', icon: Images };
const PRACTICE: NavItem = { id: 'practice', label: 'Practice', icon: Target };
const MENTOR: NavItem = { id: 'mentor', label: 'Mentor', icon: MessageCircle };
const PRINT: NavItem = { id: 'print', label: 'Print Sales', icon: Store };

/** Mobile bottom bar — 4 core items (3 while Practice is deferred). */
export function bottomNavItems(_mode: UserMode): NavItem[] {
  return [HOME, WORK, ...(FEATURES.practice ? [PRACTICE] : []), MENTOR];
}

/** Desktop sidebar — working pro gets Print Sales (while FEATURES.printSales
 * is on); Practice deferred for all. */
export function sidebarNavItems(mode: UserMode): NavItem[] {
  const base = [HOME, WORK, ...(FEATURES.practice ? [PRACTICE] : []), MENTOR];
  return mode === 'working_pro' && FEATURES.printSales ? [...base, PRINT] : base;
}

export function isAppTab(value: string): value is AppTab {
  return ['home', 'work', 'practice', 'mentor', 'print', 'settings'].includes(value);
}

/** Map legacy tab hashes to new structure for backwards compatibility. */
export function migrateLegacyTab(tab: string): AppTab | null {
  const legacyMap: Record<string, AppTab> = {
    studio: 'work',
    memory: 'work',
    field: 'practice',
    triage: 'mentor',
  };
  if (isAppTab(tab)) return tab;
  return legacyMap[tab] ?? null;
}

export function tabFromHash(): AppTab | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return null;
  // Try direct match first, then legacy migration
  const tab = isAppTab(raw) ? raw : migrateLegacyTab(raw);
  // A stale #practice/#field hash (bookmark, or carried over from a prior
  // session before this build deferred the tab) must not strand the user
  // on a tab with no nav entry pointing back at it.
  if (tab === 'practice' && !FEATURES.practice) return null;
  if (tab === 'print' && !FEATURES.printSales) return null;
  return tab;
}

export function setTabHash(tab: AppTab): void {
  if (typeof window === 'undefined') return;
  const next = `#${tab}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${next}`);
  }
}
