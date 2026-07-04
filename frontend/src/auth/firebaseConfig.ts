/** Firebase web config — optional; demo mode works without these env vars. */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'practice-companion-hackathon',
};

export const firebaseAuthEnabled =
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain);
