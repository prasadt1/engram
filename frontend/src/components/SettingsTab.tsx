import React from 'react';
import { LogIn, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { firebaseAuthEnabled } from '../auth/firebaseConfig';
import { ModeToggle } from './ModeToggle';
import { ThemeToggle } from './ThemeToggle';
import { Button, Card, Eyebrow } from './primitives';
import { clearOnboardingComplete } from '../lib/onboarding';
import { applyTheme, type ThemeMode } from '../lib/theme';
import { isLocalDevHost } from '../lib/apiHelp';
import type { UserMode } from '../types/practice';

interface Props {
  mode: UserMode;
  onModeChange: (mode: UserMode) => void;
  onPersistPersona: (mode: UserMode) => Promise<void>;
  onPersistError: (message: string) => void;
  onRestartOnboarding: () => void;
  onRestartTour?: () => void;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export const SettingsTab: React.FC<Props> = ({
  mode,
  onModeChange,
  onPersistPersona,
  onPersistError,
  onRestartOnboarding,
  onRestartTour,
  theme,
  onThemeChange,
}) => {
  const isLocal = isLocalDevHost();
  const auth = useAuth();

  return (
    <div className="animate-fadeIn max-w-lg space-y-8">
      <div>
        <Eyebrow tone="brand" className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5" />
          Settings
        </Eyebrow>
        <h1 className="font-serif text-2xl md:text-3xl text-white">Your profile</h1>
        <p className="text-muted text-sm mt-2">
          Switch between hobbyist and working pro. I&apos;ll adjust listings, suggestions, and how
          I coach you.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-white mb-3">Account</h2>
        {firebaseAuthEnabled ? (
          auth.userId ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Signed in as <span className="text-stone-200">{auth.email ?? auth.userId}</span>.
                Your library is scoped to this account.
              </p>
              <p className="text-xs text-muted font-mono break-all">
                User id: {auth.userId}
              </p>
              <p className="text-xs text-muted leading-relaxed">
                Must match the User id shown in the iPhone app Settings (same Google account).
                Without sign-in, the site shows the shared judge demo library — not your field
                captures.
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<LogOut className="w-4 h-4" />}
                onClick={() => void auth.signOut()}
              >
                Sign out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted leading-relaxed">
                Sign in with Google to keep your portfolio and critiques on your own MongoDB user
                (multi-tenant demo). Without sign-in, the hosted API uses the shared judge demo
                profile.
              </p>
              <Button
                size="sm"
                icon={<LogIn className="w-4 h-4" />}
                disabled={auth.loading}
                onClick={() => void auth.signInWithGoogle()}
              >
                Sign in with Google
              </Button>
            </div>
          )
        ) : (
          <p className="text-sm text-muted leading-relaxed">
            Firebase web keys are not configured for this build — the API uses the shared demo user.
            Add <code className="text-brand-400 text-xs">VITE_FIREBASE_*</code> for sign-in.
          </p>
        )}
      </Card>

      <Card>
        <ThemeToggle
          theme={theme}
          onChange={(m) => {
            applyTheme(m);
            onThemeChange(m);
          }}
        />
      </Card>

      <Card>
        <ModeToggle
          mode={mode}
          onModeChange={onModeChange}
          onPersistPersona={onPersistPersona}
          onPersistError={onPersistError}
        />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-white mb-3">What I remember</h2>
        <p className="text-sm text-muted leading-relaxed">
          Your uploads, scores, Glass Box reasoning, tags, practice assignments, and approval
          history live in your private MongoDB library — tied to this demo profile in your browser.
          I do not publish listings or change labels until you approve each suggestion.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-white mb-3">Privacy</h2>
        <p className="text-sm text-muted leading-relaxed">
          Your photos and critiques stay in your private library. Listing and label changes only
          happen when you approve them.
        </p>
      </Card>

      {isLocal && (
        <Card className="bg-canvas-elevated border-warm/80">
          <h2 className="text-sm font-semibold text-muted mb-2">Developer (local only)</h2>
          <p className="text-xs text-muted">
            API: run <code className="text-brand-400">make api-dev</code> on port 8081 before using
            Mentor or approvals.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        <Button
          variant="subtle"
          size="sm"
          onClick={() => {
            clearOnboardingComplete();
            onRestartOnboarding();
          }}
        >
          Show welcome screen again
        </Button>
        {onRestartTour && (
          <Button variant="subtle" size="sm" onClick={onRestartTour}>
            Take a feature tour
          </Button>
        )}
      </div>
    </div>
  );
};
