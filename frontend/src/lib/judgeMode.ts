/**
 * Judge mode — zero-friction entry for hackathon judges / demo click-testing.
 *
 * `?judge=1` scopes the app to the seeded demo-user journey, skips onboarding,
 * and lands directly on Home with the in-app judge banner. The query param is
 * preserved on every in-app navigation so refresh/back stay in judge mode.
 */

const JUDGE_QUERY_KEY = 'judge';
const JUDGE_HASH = 'judge';
export const JUDGE_DEMO_USER_ID = 'demo-user';

export function isJudgeModeRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get(JUDGE_QUERY_KEY) === '1') return true;
  const hash = window.location.hash.replace(/^#/, '');
  return hash === JUDGE_HASH;
}

/** Current path + search + hash — keeps ?judge=1 when changing tabs. */
export function buildAppUrl(pathname: string, hash: string): string {
  if (typeof window === 'undefined') return `${pathname}${hash}`;
  const search = window.location.search;
  return `${pathname}${search}${hash}`;
}

export function setAppHash(hash: string): void {
  if (typeof window === 'undefined') return;
  const normalized = hash.startsWith('#') ? hash : `#${hash}`;
  const next = buildAppUrl(window.location.pathname, normalized);
  if (window.location.pathname + window.location.search + window.location.hash !== next) {
    window.history.replaceState(null, '', next);
  }
}
