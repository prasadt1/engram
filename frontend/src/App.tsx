import { useCallback, useEffect, useState } from 'react';
import { Camera, CheckCircle2, Settings, Store, Target } from 'lucide-react';
import { AppSidebar } from './components/AppSidebar';
import { BottomNav } from './components/BottomNav';
import { BrandLogo } from './components/BrandLogo';
import { LogoComparison } from './components/LogoComparison';
import { HomeTab } from './components/HomeTab';
import { MyWorkTab } from './components/MyWorkTab';
import { MentorTab } from './components/MentorTab';
import { OnboardingScreen } from './components/OnboardingScreen';
import { PracticeTab } from './components/PracticeTab';
import { PrintSalesTab } from './components/PrintSalesTab';
import { SettingsTab } from './components/SettingsTab';
import { FieldTab } from './components/FieldTab';
import { GlassBoxTab } from './components/GlassBoxTab';
import { InlineAlertBanner } from './components/InlineAlertBanner';
import { ScoreExplainer, ScoreExplainerTrigger } from './components/ScoreExplainer';
import { OnboardingTour, resetTour } from './components/OnboardingTour';
import { JudgeWelcome } from './components/JudgeWelcome';
import { getStoredTheme, type ThemeMode } from './lib/theme';
import { ThemeProvider } from './lib/ThemeContext';
import type { AppTab } from './config/navConfig';
import { isAppTab, setTabHash, tabFromHash } from './config/navConfig';
import { FEATURES } from './config/features';
import { useAuth } from './auth/useAuth';
import { setApiUserScope } from './lib/apiFetch';
import { clearMentorSession } from './services/mentorClient';
import { fetchActiveAssignment } from './services/practiceClient';
import {
  fetchAestheticProfile,
  fetchPortfolioStats,
} from './services/memoryClient';
import { fetchCoachingSnapshot } from './services/journeyClient';
import {
  buildNextShotBrief,
  buildSidebarFocusDisplay,
  buildSidebarMentorLine,
  currentFocusFromJourney,
  type SidebarFocusDisplay,
} from './lib/coachingBrief';
import { fetchPendingApprovals } from './services/triageClient';
import { fetchPrintPending } from './services/printSalesClient';
import { fetchUserProfile, personaToUserMode, updatePersona } from './services/userClient';
import { effectiveUserMode } from './lib/effectiveUserMode';
import { OfflineBanner } from './components/OfflineBanner';
import { FilmGrain } from './components/FilmGrain';
import { Tabs } from './components/Tabs';
import { useToast } from './components/ToastHost';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  isOnboardingComplete,
  serverOnboardingComplete,
  setOnboardingComplete,
  clearOnboardingComplete,
} from './lib/onboarding';
import { JudgeTour, resetJudgeTour } from './components/JudgeTour';
import {
  dismissJudgeWelcome,
  isJudgeModeRequested,
  isJudgeWelcomeDismissed,
  JUDGE_DEMO_USER_ID,
  setAppHash,
} from './lib/judgeMode';
import type { AnalysisResult } from './types';
import type { Assignment, UserMode } from './types/practice';

const JUDGE_TOUR_STORAGE_KEYS = ['engram-tour-completed-v2', 'engram-tour-completed'];
const JUDGE_BANNER_DISMISSED_KEY = 'engram_judge_banner_dismissed';
const SHARED_DEMO_BANNER_DISMISSED_KEY = 'engram_shared_demo_banner_dismissed';

function sharedDemoJudgeUrl(): string {
  if (typeof window === 'undefined') return '/?judge=1';
  const url = new URL(window.location.href);
  url.searchParams.set('judge', '1');
  return url.toString();
}

function MobileHeaderMark() {
  return <BrandLogo variant="mark" markSize={30} />;
}

/** Pending analysis result to show in My Work after upload from Home */
interface PendingAnalysis {
  result: AnalysisResult;
  imageUrl: string;
  filename: string;
}

function App() {
  // Judge mode (?judge=1 or #judge): computed once from the URL at mount —
  // it never changes mid-session, so a plain lazy initializer (not a
  // useEffect) is enough, and lets showOnboarding's own initializer below
  // see the flags as already-set on the very first render (no onboarding
  // flash before the skip effect would otherwise fire).
  const [judgeMode] = useState<boolean>(() => {
    const requested = isJudgeModeRequested();
    if (requested) {
      setOnboardingComplete();
      // Scope demo-user synchronously so Home's first fetch never races auth init.
      setApiUserScope(JUDGE_DEMO_USER_ID);
      JUDGE_TOUR_STORAGE_KEYS.forEach((key) => {
        if (typeof window !== 'undefined') localStorage.setItem(key, 'true');
      });
    }
    return requested;
  });
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!isOnboardingComplete());
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [userMode, setUserMode] = useState<UserMode>('hobbyist');
  const [showJudgeBanner, setShowJudgeBanner] = useState(
    () => judgeMode && typeof window !== 'undefined' && localStorage.getItem(JUDGE_BANNER_DISMISSED_KEY) !== 'true',
  );
  const [showSharedDemoBanner, setShowSharedDemoBanner] = useState(
    () =>
      !judgeMode &&
      typeof window !== 'undefined' &&
      localStorage.getItem(SHARED_DEMO_BANNER_DISMISSED_KEY) !== 'true',
  );
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  // Sub-views within Practice tab
  const [practiceView, setPracticeView] = useState<'list' | 'field'>('list');
  // Focus skill to auto-trigger in Practice (from Focus Areas CTA)
  const [practiceFocusSkill, setPracticeFocusSkill] = useState<string | null>(null);
  // Pending analysis result from Home upload (to show in My Work)
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(null);
  // Global score explainer modal
  const [showScoreExplainer, setShowScoreExplainer] = useState(false);
  // Onboarding tour
  const [showTour, setShowTour] = useState(false);
  const [showJudgeTour, setShowJudgeTour] = useState(false);
  const [showJudgeWelcome, setShowJudgeWelcome] = useState(
    () => judgeMode && !isJudgeWelcomeDismissed(),
  );
  /** True when judge guide was reopened from the in-app banner (not first load). */
  const [judgeGuideReopened, setJudgeGuideReopened] = useState(false);

  const closeJudgeGuide = useCallback(() => {
    setShowJudgeWelcome(false);
    setJudgeGuideReopened(false);
    dismissJudgeWelcome();
  }, []);

  const openJudgeGuide = useCallback(() => {
    setJudgeGuideReopened(true);
    setShowJudgeWelcome(true);
    window.history.pushState({ engramJudgeGuide: true }, '');
  }, []);

  useEffect(() => {
    const onPop = () => {
      setShowJudgeWelcome((open) => {
        if (!open) return open;
        setJudgeGuideReopened(false);
        dismissJudgeWelcome();
        return false;
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [focusPhotoId, setFocusPhotoId] = useState<string | null>(null);
  const [portfolioRefreshKey, setPortfolioRefreshKey] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [showLogoCompare, setShowLogoCompare] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#logo-compare',
  );
  // Glass box: judge-facing internals + benchmark page. Reached from the
  // sidebar's "Proof" nav group and the footer link (both drive the same
  // #glassbox hash) — it's a reference surface for evaluators, not a
  // feature a photographer needs day to day. Modeled as a flag alongside
  // activeTab (like showLogoCompare) rather than an AppTab member, so it
  // can't accidentally leak into bottomNavItems/sidebarNavItems — and so
  // activeTab is preserved underneath, restoring the previous tab when the
  // user navigates back to normal nav. Unlike showLogoCompare it renders
  // inside the normal shell (sidebar/footer intact) via the activeTab-style
  // conditional in <main>, per this task's routing spec.
  const [showGlassBox, setShowGlassBox] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#glassbox',
  );
  const [practiceDetailId, setPracticeDetailId] = useState<string | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [sidebarPhotoCount, setSidebarPhotoCount] = useState(0);
  const [sidebarFocus, setSidebarFocus] = useState<SidebarFocusDisplay | null>(null);
  const [sidebarNextShotBrief, setSidebarNextShotBrief] = useState<string | null>(null);
  const [sidebarMentorLine, setSidebarMentorLine] = useState<string | null>(null);
  const [pendingOrganize, setPendingOrganize] = useState(0);
  const [pendingPrintDrafts, setPendingPrintDrafts] = useState(0);
  const online = useOnlineStatus();
  const auth = useAuth();
  const toast = useToast();

  const navigate = useCallback((tab: AppTab) => {
    // Single choke point for every onNavigate/CTA in the tree (sidebar,
    // bottom nav, HomeTab's "Go to Practice" buttons, MyWorkTab's
    // onGoToPractice). Practice has no nav entry while FEATURES.practice
    // is off, and Print Sales has none while FEATURES.printSales is off,
    // so a stray CTA landing here must not strand the user on an
    // unrendered tab — fall back to home instead.
    const target =
      (tab === 'practice' && !FEATURES.practice) || (tab === 'print' && !FEATURES.printSales)
        ? 'home'
        : tab;
    setActiveTab(target);
    setTabHash(target);
    // Glass box lives outside the AppTab union (see showGlassBox above), so
    // it isn't cleared by setActiveTab — without this, a sidebar/bottom-nav
    // click while on #glassbox would update the hash but leave the Glass
    // box page rendered on top of it.
    setShowGlassBox(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openPhotoInWork = useCallback(
    (photoId: string) => {
      setFocusPhotoId(photoId);
      navigate('work');
    },
    [navigate],
  );

  const navigateToGlassBox = useCallback(() => {
    setShowGlassBox(true);
    setAppHash('#glassbox');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshActiveAssignment = useCallback(async () => {
    // Dedicated poll: fires on every tab switch (see the useEffect below).
    // FEATURES.practice is off in this build — no /api/v1/assignments*
    // routes exist on the backend — so skip the network call entirely
    // rather than firing a guaranteed-404 on every navigation. null is the
    // truthful state: there is no active assignment to report.
    if (!FEATURES.practice) {
      setActiveAssignment(null);
      return;
    }
    try {
      setActiveAssignment(await fetchActiveAssignment());
    } catch {
      setActiveAssignment(null);
    }
  }, []);

  useEffect(() => {
    const onHash = () => {
      setShowLogoCompare(window.location.hash === '#logo-compare');
      setShowGlassBox(window.location.hash === '#glassbox');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const hashTab = tabFromHash();
    if (hashTab && isAppTab(hashTab)) {
      setActiveTab(hashTab);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    // Judge mode always wins: it must scope to the seeded demo-user even if
    // a real auth session is (or later becomes) signed in, so a judge
    // opening ?judge=1 never sees — or contaminates — a real account.
    const scopedUserId = judgeMode ? JUDGE_DEMO_USER_ID : auth.userId;
    setApiUserScope(scopedUserId);
    void fetchUserProfile(scopedUserId ?? undefined)
      .then((p) => setUserMode(effectiveUserMode(personaToUserMode(p.persona))))
      .catch(() => {});
  }, [auth.loading, auth.userId, judgeMode]);

  useEffect(() => {
    if (auth.userId) setShowSharedDemoBanner(false);
  }, [auth.userId]);

  useEffect(() => {
    if (!ready || auth.loading || isOnboardingComplete() || onboardingBusy) return;
    void fetchUserProfile(auth.userId ?? undefined)
      .then((profile) => {
        if (serverOnboardingComplete(profile.preferences)) {
          setOnboardingComplete();
          setShowOnboarding(false);
          setUserMode(effectiveUserMode(personaToUserMode(profile.persona)));
        }
      })
      .catch(() => {});
  }, [ready, auth.loading, auth.userId, onboardingBusy]);

  useEffect(() => {
    if (!ready) return;
    void refreshActiveAssignment();
    // Reset sub-views when leaving tabs
    if (activeTab !== 'practice') {
      setPracticeView('list');
      setPracticeDetailId(null);
    }
  }, [activeTab, ready, refreshActiveAssignment]);

  const refreshSidebarDashboard = useCallback(async () => {
    try {
      const [stats, aesthetic, coaching, triagePending, printPending] = await Promise.all([
        fetchPortfolioStats(),
        fetchAestheticProfile().catch(() => null),
        fetchCoachingSnapshot().catch(() => null),
        FEATURES.triage
          ? fetchPendingApprovals('triage').catch(() => ({ items: [], total: 0 }))
          : Promise.resolve({ items: [], total: 0 }),
        userMode === 'working_pro' && FEATURES.printSales
          ? fetchPrintPending().catch(() => ({ items: [], total: 0 }))
          : Promise.resolve({ items: [], total: 0 }),
      ]);

      setSidebarPhotoCount(stats.total);
      setPendingOrganize(triagePending.total);

      const focus = currentFocusFromJourney(coaching?.skills);
      const focusSkill = focus?.name ?? null;
      setSidebarFocus(
        stats.total > 0 ? buildSidebarFocusDisplay(focus, coaching?.skills) : null,
      );
      setSidebarNextShotBrief(stats.total > 0 ? buildNextShotBrief(focusSkill) : null);

      setSidebarMentorLine(
        buildSidebarMentorLine({
          identity: coaching?.identity,
          dominantTags: aesthetic?.dominantTags,
          photoCount: stats.total,
        }),
      );

      setPendingPrintDrafts(printPending.total);
    } catch {
      /* sidebar degrades gracefully */
    }
  }, [userMode]);

  const handlePortfolioChanged = useCallback(() => {
    setPortfolioRefreshKey((k) => k + 1);
    void refreshSidebarDashboard();
  }, [refreshSidebarDashboard]);

  useEffect(() => {
    if (!ready || auth.loading) return;
    void refreshSidebarDashboard();
  }, [ready, auth.loading, auth.userId, activeTab, refreshSidebarDashboard]);

  const handleOnboardingComplete = useCallback((mode: UserMode) => {
    setOnboardingComplete();
    setShowOnboarding(false);
    setUserMode(effectiveUserMode(mode));
    setActiveTab('home');
    setTabHash('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const persistPersona = useCallback(async (mode: UserMode) => {
    setOnboardingBusy(true);
    setPersonaError(null);
    try {
      await updatePersona(mode, auth.userId);
      clearMentorSession();
    } finally {
      setOnboardingBusy(false);
    }
  }, [auth.userId]);

  if (showLogoCompare) {
    return (
      <ThemeProvider theme={theme}>
        <LogoComparison />
      </ThemeProvider>
    );
  }

  if (!ready) {
    return (
      <ThemeProvider theme={theme}>
        <div className="min-h-screen bg-canvas flex items-center justify-center text-muted text-sm">
          One moment…
        </div>
      </ThemeProvider>
    );
  }

  if (showOnboarding) {
    return (
      <ThemeProvider theme={theme}>
        <OnboardingScreen
          onComplete={handleOnboardingComplete}
          onPersist={persistPersona}
        />
      </ThemeProvider>
    );
  }

  if (showJudgeWelcome && judgeMode) {
    return (
      <ThemeProvider theme={theme}>
        <JudgeWelcome
          onEnterDemo={() => {
            setJudgeGuideReopened(false);
            setShowJudgeWelcome(false);
          }}
          onStartTour={() => {
            setJudgeGuideReopened(false);
            setShowJudgeWelcome(false);
            resetJudgeTour();
            setShowJudgeTour(true);
          }}
          onOpenProof={() => {
            setJudgeGuideReopened(false);
            setShowJudgeWelcome(false);
            navigateToGlassBox();
          }}
          onBack={
            judgeGuideReopened
              ? () => {
                  if (window.history.state?.engramJudgeGuide) {
                    window.history.back();
                  } else {
                    closeJudgeGuide();
                  }
                }
              : undefined
          }
        />
        {showJudgeTour && (
          <JudgeTour forceShow onComplete={() => setShowJudgeTour(false)} />
        )}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
    <div className="min-h-screen bg-canvas text-stone-200 font-sans selection:bg-brand-500/30 flex relative">
      <a href="#main-content" className="sr-only">
        Skip to main content
      </a>
      <AppSidebar
        activeTab={activeTab}
        mode={userMode}
        onNavigate={navigate}
        glassBoxActive={showGlassBox}
        onNavigateGlassBox={navigateToGlassBox}
        photoCount={sidebarPhotoCount}
        focusDisplay={sidebarFocus}
        nextShotBrief={sidebarNextShotBrief}
        mentorOneLiner={sidebarMentorLine}
        activeAssignment={activeAssignment}
        pendingOrganize={pendingOrganize}
        pendingPrintDrafts={pendingPrintDrafts}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0 pb-20 lg:pb-0 relative">
        <FilmGrain className="absolute inset-0 z-[1] pointer-events-none" />
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-3 py-2.5 border-b border-warm bg-canvas/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="min-w-0 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 rounded-md"
            aria-label="Go to Home"
          >
            <MobileHeaderMark />
            {judgeMode && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 border border-brand-500/40 rounded px-1.5 py-0.5">
                Judge
              </span>
            )}
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {userMode === 'working_pro' && FEATURES.printSales && (
              <button
                type="button"
                onClick={() => navigate('print')}
                aria-label="Print Sales"
                aria-current={activeTab === 'print' ? 'page' : undefined}
                className={`p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
                  activeTab === 'print'
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-muted hover:text-white hover:bg-surface-2'
                }`}
              >
                <Store className="w-5 h-5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('settings')}
              aria-label="Settings"
              aria-current={activeTab === 'settings' ? 'page' : undefined}
              className={`p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${
                activeTab === 'settings'
                  ? 'text-brand-400 bg-brand-500/10'
                  : 'text-muted hover:text-white hover:bg-surface-2'
              }`}
            >
              <Settings className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </header>

        <main
          id="main-content"
          key={activeTab}
          className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 py-4 md:py-6 animate-tabEnter"
        >
          {!online && <OfflineBanner />}
          {showSharedDemoBanner && !judgeMode && !auth.userId && (
            <div className="mb-4 space-y-2">
              <InlineAlertBanner
                variant="info"
                message="Shared demo library — you're viewing a seeded photographer with live critiques and memory. Uploads add to this demo unless you sign in."
                onDismiss={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(SHARED_DEMO_BANNER_DISMISSED_KEY, 'true');
                  }
                  setShowSharedDemoBanner(false);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <a
                  href={sharedDemoJudgeUrl()}
                  className="text-sm px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/30 hover:bg-brand-500/30 transition-colors"
                >
                  Hackathon judge guide →
                </a>
              </div>
            </div>
          )}
          {showJudgeBanner && (
            <div className="mb-4 space-y-2">
              <InlineAlertBanner
                variant="info"
                message="Judge demo — seeded photographer with live memory proof. Same Home / Work / Mentor UX as regular users; data scoped to demo-user."
                onDismiss={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(JUDGE_BANNER_DISMISSED_KEY, 'true');
                  }
                  setShowJudgeBanner(false);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openJudgeGuide}
                  className="text-sm px-3 py-1.5 rounded-lg border border-warm text-stone-300 hover:text-white hover:border-brand-500/40 transition-colors"
                >
                  Judge guide
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetJudgeTour();
                    setShowJudgeTour(true);
                  }}
                  className="text-sm px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/30 hover:bg-brand-500/30 transition-colors"
                >
                  Run judge walkthrough
                </button>
                <button
                  type="button"
                  onClick={navigateToGlassBox}
                  className="text-sm px-3 py-1.5 rounded-lg border border-warm text-stone-300 hover:text-white hover:border-brand-500/40 transition-colors"
                >
                  Memory Proof Room →
                </button>
              </div>
            </div>
          )}
          {personaError && activeTab === 'settings' && !showGlassBox && (
            <p className="mb-4 text-sm text-amber-400" role="alert">
              Could not save your profile mode ({personaError}).
            </p>
          )}

          {/* Glass box (#glassbox) takes over <main> entirely, independent
              of activeTab — see showGlassBox above for why it's a sibling
              flag rather than an AppTab member. Without this early branch,
              the activeTab-matched block below would render underneath it
              (both share <main>), duplicating whatever tab was active
              before the footer link was clicked. */}
          {showGlassBox ? (
            <GlassBoxTab />
          ) : (
            <>
          {activeTab === 'home' && (
            <HomeTab
              mode={userMode}
              activeAssignment={activeAssignment}
              useDemoLibrary={!auth.userId}
              isActive={activeTab === 'home'}
              portfolioRefreshKey={portfolioRefreshKey}
              onNavigate={navigate}
              onOpenSettings={() => navigate('settings')}
              onOpenProof={navigateToGlassBox}
              onOpenPhoto={openPhotoInWork}
              onAnalysisComplete={(result, imageUrl, filename) => {
                toast({
                  variant: 'brand',
                  icon: <CheckCircle2 className="w-[18px] h-[18px]" />,
                  title: 'Critique ready',
                  message: "I've scored your frame on five dimensions.",
                });
                setPendingAnalysis({ result, imageUrl, filename });
                void refreshActiveAssignment();
                void refreshSidebarDashboard();
                navigate('work');
              }}
            />
          )}

          {activeTab === 'work' && (
            <MyWorkTab
              mode={userMode}
              judgeMode={judgeMode}
              focusPhotoId={focusPhotoId}
              onFocusPhotoHandled={() => setFocusPhotoId(null)}
              activeAssignment={activeAssignment}
              onAssignmentComplete={refreshActiveAssignment}
              onPortfolioChanged={handlePortfolioChanged}
              onGoHome={() => navigate('home')}
              onGoToPractice={(focusDimension) => {
                if (focusDimension) {
                  setPracticeFocusSkill(focusDimension);
                }
                navigate('practice');
              }}
              pendingAnalysis={pendingAnalysis}
              onClearPendingAnalysis={() => setPendingAnalysis(null)}
            />
          )}

          {/* Practice tab (assignments + Field capture sub-view) is deferred
              in this build — FEATURES.practice is false because no
              /api/v1/assignments* routes exist on the backend yet. Gating
              the render (not just the nav entry) covers stray entry points
              like MyWorkTab's "Go to Practice" CTA, which still calls
              navigate('practice') below. */}
          {activeTab === 'practice' && FEATURES.practice && (
            <Tabs
              value={practiceView}
              onChange={(v) => setPracticeView(v as 'list' | 'field')}
              tabs={[
                { id: 'list', label: 'Assignments', icon: <Target className="w-[15px] h-[15px]" /> },
                { id: 'field', label: 'Field', icon: <Camera className="w-[15px] h-[15px]" /> },
              ]}
            >
              {practiceView === 'list' ? (
                <PracticeTab
                  mode={userMode}
                  focusSkill={practiceFocusSkill}
                  onClearFocusSkill={() => setPracticeFocusSkill(null)}
                  onGoToStudio={() => navigate('work')}
                  onGoToField={() => setPracticeView('field')}
                  onAssignmentsChange={refreshActiveAssignment}
                  detailAssignmentId={practiceDetailId}
                  onOpenAssignmentDetail={setPracticeDetailId}
                  onCloseAssignmentDetail={() => setPracticeDetailId(null)}
                />
              ) : (
                <FieldTab
                  assignment={activeAssignment}
                  onCaptureAnalyzed={refreshActiveAssignment}
                  onGoToPractice={() => setPracticeView('list')}
                />
              )}
            </Tabs>
          )}

          {activeTab === 'mentor' && (
            <MentorTab mode={userMode} judgeMode={judgeMode} onGoToWork={() => navigate('work')} />
          )}

          {/* Print Sales tab is deferred in this build — FEATURES.printSales
              is false because the /api/v1/pending-approvals* routes it
              needs don't exist on the backend yet. Gating the render (not
              just the nav entry) covers stray entry points like the mobile
              header icon and the sidebar's own tab list. */}
          {activeTab === 'print' && FEATURES.printSales && (
            <PrintSalesTab
              mode={userMode}
              onGoToMentor={() => navigate('mentor')}
              onGoToWork={() => navigate('work')}
              onOpenSettings={() => navigate('settings')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              mode={userMode}
              onModeChange={setUserMode}
              onPersistPersona={persistPersona}
              onPersistError={setPersonaError}
              onRestartOnboarding={() => {
                clearOnboardingComplete();
                setShowOnboarding(true);
              }}
              onRestartTour={() => {
                resetTour();
                setShowTour(true);
              }}
              theme={theme}
              onThemeChange={setTheme}
            />
          )}
            </>
          )}
        </main>

        <footer className="relative z-10 border-t border-warm py-6 px-4 md:px-8 bg-canvas mb-16 lg:mb-0">
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <p className="text-sm text-stone-300">
              Engram — your AI photography mentor that remembers every shot you upload.
            </p>
            <p className="text-xs text-stone-400 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span>Your photos stay in your private library. You approve every tag and listing.</span>
              <span className="text-warm" aria-hidden>
                ·
              </span>
              <ScoreExplainerTrigger variant="footer" onClick={() => setShowScoreExplainer(true)} />
              <span className="text-warm" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => {
                  resetTour();
                  setShowTour(true);
                }}
                className="text-brand-400 hover:text-brand-300 hover:underline transition-colors"
              >
                How it works
              </button>
              <span className="text-warm" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={navigateToGlassBox}
                aria-current={showGlassBox ? 'page' : undefined}
                className="text-brand-400 hover:text-brand-300 hover:underline transition-colors"
              >
                Memory Proof Room
              </button>
            </p>
            <p className="text-xs text-stone-500">
              Built by a fellow photographer — for the work you do between workshops, critiques, and shoots.
            </p>
          </div>
        </footer>
      </div>

      <BottomNav
        activeTab={activeTab}
        mode={userMode}
        onNavigate={navigate}
        judgeMode={judgeMode}
        glassBoxActive={showGlassBox}
        onNavigateProof={navigateToGlassBox}
      />

      {/* Global Score Explainer Modal */}
      <ScoreExplainer isOpen={showScoreExplainer} onClose={() => setShowScoreExplainer(false)} />

      {/* Onboarding Tour (shows on first visit or when restarted) */}
      <OnboardingTour
        forceShow={showTour}
        onComplete={() => setShowTour(false)}
      />

      {judgeMode && (
        <JudgeTour
          forceShow={showJudgeTour}
          onComplete={() => setShowJudgeTour(false)}
        />
      )}
    </div>
    </ThemeProvider>
  );
}

export default App;
