import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, Settings, Store } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { firebaseAuthEnabled } from '../auth/firebaseConfig';
import { ThemeToggle } from './ThemeToggle';
import { Button, Card, Eyebrow, TextInput } from './primitives';
import { clearOnboardingComplete } from '../lib/onboarding';
import { applyTheme, type ThemeMode } from '../lib/theme';
import { isLocalDevHost } from '../lib/apiHelp';
import { fetchUserProfile, updateDisplayName } from '../services/userClient';
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
  mode: _mode,
  onModeChange: _onModeChange,
  onPersistPersona: _onPersistPersona,
  onPersistError,
  onRestartOnboarding,
  onRestartTour,
  theme,
  onThemeChange,
}) => {
  const isLocal = isLocalDevHost();
  const auth = useAuth();

  // "Your name" — same save pattern as the persona switcher (ModeToggle):
  // local saving state, failures surfaced through onPersistError.
  const [displayName, setDisplayName] = useState('');
  const [nameLoaded, setNameLoaded] = useState(false);
  const [nameFetchFailed, setNameFetchFailed] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (auth.loading) return;
    let cancelled = false;
    fetchUserProfile(auth.userId)
      .then((profile) => {
        if (cancelled) return;
        setDisplayName(profile.displayName ?? '');
        setNameLoaded(true);
      })
      .catch(() => {
        // Profile fetch failing shouldn't lock the field — start blank, but
        // remember the failure: the blank field may be hiding a saved name.
        if (!cancelled) {
          setNameFetchFailed(true);
          setNameLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth.loading, auth.userId]);

  const saveName = async () => {
    // A blank PATCH clears the saved name. If the initial fetch failed we
    // never saw the server state, so a blank save here could silently wipe
    // an existing name the user didn't intend to clear.
    if (nameFetchFailed && displayName.trim() === '') {
      onPersistError('Could not load your saved name — type it (or a new one) before saving.');
      return;
    }
    setSavingName(true);
    setNameSaved(false);
    try {
      const result = await updateDisplayName(displayName.trim(), auth.userId);
      setDisplayName(result.displayName ?? '');
      setNameFetchFailed(false);
      setNameSaved(true);
    } catch (e) {
      onPersistError(e instanceof Error ? e.message : 'Could not save your name');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="animate-fadeIn max-w-lg space-y-8">
      <div>
        <Eyebrow tone="brand" className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5" />
          Settings
        </Eyebrow>
        <h1 className="font-serif text-2xl md:text-3xl text-white">Your profile</h1>
        <p className="text-muted text-sm mt-2">
          Hobbyist coaching is the default in this build — upload, critique, mentor chat, and skill
          graduation on your private library.
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
                Without sign-in, the site shows the shared judge demo library — not your private
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
        <h2 className="text-sm font-semibold text-white mb-1">Your name</h2>
        <p className="text-sm text-muted mb-3">
          I&apos;ll greet you by name on your Home page. Leave it blank to stay anonymous.
        </p>
        <form
          className="flex items-stretch gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
        >
          <TextInput
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setNameSaved(false);
            }}
            placeholder="e.g. Asha"
            maxLength={80}
            aria-label="Your name"
            disabled={!nameLoaded || savingName}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!nameLoaded || savingName}>
            {savingName ? 'Saving…' : 'Save'}
          </Button>
        </form>
        {nameSaved && (
          <p className="text-xs text-brand-400 mt-2" role="status">
            Saved — Home will greet you by name.
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
        <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Store className="w-4 h-4 text-brand-400" aria-hidden />
          Pro workflow
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 border border-brand-500/40 rounded px-1.5 py-0.5">
            Coming
          </span>
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-3">
          Print readiness, listing drafts, and portfolio consistency checks — on the same memory
          layer as coaching (engram-mcp). Not live in this hackathon build.
        </p>
        <ul className="text-xs text-muted space-y-1.5 list-disc list-inside">
          <li>Print sales readiness scoring</li>
          <li>Listing draft review before publish</li>
          <li>Consistency tracking across client shoots</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-white mb-3">What I remember</h2>
        <p className="text-sm text-muted leading-relaxed">
          Your critiques, scores, genres, and the skills you&apos;re working on live in your
          private MongoDB library — tied to this demo profile in your browser. I do not publish
          listings or change labels until you approve each suggestion.
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
            API: run <code className="text-brand-400">uvicorn app.server:app --reload --port 8000</code>{' '}
            (or <code className="text-brand-400">make api-dev</code>) before using Mentor.
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
