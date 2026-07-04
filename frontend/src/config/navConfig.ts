import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Images,
  Target,
  MessageCircle,
  Store,
} from 'lucide-react';
import type { UserMode } from '../types/practice';

/**
 * Navigation structure (v2 — photo-first restructure)
 *
 * Consolidated from 8 tabs to 5:
 * - home: Photo-first dashboard with progress + assignment context
 * - work: Merged Studio + Memory (upload + gallery)
 * - practice: Merged Practice + Field (assignments + capture)
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

/** Mobile bottom bar — 4 core items. */
export function bottomNavItems(_mode: UserMode): NavItem[] {
  return [HOME, WORK, PRACTICE, MENTOR];
}

/** Desktop sidebar — working pro gets Print Sales. */
export function sidebarNavItems(mode: UserMode): NavItem[] {
  if (mode === 'working_pro') {
    return [HOME, WORK, PRACTICE, MENTOR, PRINT];
  }
  return [HOME, WORK, PRACTICE, MENTOR];
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
  return isAppTab(raw) ? raw : migrateLegacyTab(raw);
}

export function setTabHash(tab: AppTab): void {
  if (typeof window === 'undefined') return;
  const next = `#${tab}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${next}`);
  }
}
