/** One-time migration from practice_companion_* keys to iris_* (rebrand). */
const PAIRS: { oldKey: string; store: 'local' | 'session' }[] = [
  { oldKey: 'practice_companion_onboarding_done', store: 'local' },
  { oldKey: 'practice_companion_mentor_session', store: 'session' },
  { oldKey: 'practice_companion_mentor_persona', store: 'session' },
];

function storageFor(kind: 'local' | 'session'): Storage {
  return kind === 'session' ? sessionStorage : localStorage;
}

export function migrateLegacyStorageKeys(): void {
  if (typeof window === 'undefined') return;
  for (const { oldKey, store } of PAIRS) {
    const s = storageFor(store);
    const newKey = oldKey.replace(/^practice_companion_/, 'iris_');
    const legacy = s.getItem(oldKey);
    if (legacy !== null && s.getItem(newKey) === null) {
      s.setItem(newKey, legacy);
    }
    if (legacy !== null) {
      s.removeItem(oldKey);
    }
  }
}
