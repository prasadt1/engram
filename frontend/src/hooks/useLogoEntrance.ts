import { useEffect, useState } from 'react';

const STORAGE_KEY = 'iris-logo-focused';

/** True once per browser session — drives the one-time aperture focus spin. */
export function useLogoEntrance(): boolean {
  const [animate] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (animate) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* private browsing */
      }
    }
  }, [animate]);

  return animate;
}
