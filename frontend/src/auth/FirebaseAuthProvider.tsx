import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { firebaseAuthEnabled, firebaseConfig } from './firebaseConfig';
import { setApiUserScope } from '../lib/apiFetch';

export interface AuthState {
  userId: string | null;
  email: string | null;
  loading: boolean;
  demoMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

type FirebaseAuth = import('firebase/auth').Auth;
type FirebaseUser = import('firebase/auth').User;

let authSingleton: FirebaseAuth | null = null;

async function getAuth(): Promise<FirebaseAuth | null> {
  if (!firebaseAuthEnabled) return null;
  if (authSingleton) return authSingleton;
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth } = await import('firebase/auth');
  const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  authSingleton = getAuth(app);
  return authSingleton;
}

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(firebaseAuthEnabled);

  useEffect(() => {
    if (!firebaseAuthEnabled) {
      setLoading(false);
      return;
    }
    let unsub: (() => void) | undefined;
    void (async () => {
      const auth = await getAuth();
      if (!auth) {
        setLoading(false);
        return;
      }
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(auth, (u) => {
        // Set the API scope BEFORE any component re-render fetches data —
        // child effects (e.g. My Work gallery) run before App's effects,
        // so setting it there raced and could load the demo library.
        setApiUserScope(u?.uid ?? null);
        setUser(u);
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = await getAuth();
    if (!auth) return;
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    const auth = await getAuth();
    if (!auth) return;
    const { signOut: fbSignOut } = await import('firebase/auth');
    await fbSignOut(auth);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      loading,
      demoMode: !firebaseAuthEnabled,
      signInWithGoogle,
      signOut,
    }),
    [user, loading, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
