/**
 * Judge mode — zero-friction entry for hackathon judges / demo click-testing.
 *
 * `?judge=1` (query param) or `#judge` (hash) scopes the app to the seeded
 * demo-user journey (see scripts/seed_demo_user.py), skips onboarding/tour,
 * and lands on Home. Detection is read-only and side-effect-free so it can
 * be called during render; callers apply the actual scope/localStorage
 * side effects once, on mount.
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
