import { useContext } from 'react';
import { AuthContext } from './FirebaseAuthProvider';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within FirebaseAuthProvider');
  }
  return ctx;
}
