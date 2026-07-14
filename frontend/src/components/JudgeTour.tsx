/**
 * JudgeTour — spotlight walkthrough for hackathon evaluators (?judge=1).
 * Highlights live Home regions step-by-step (Outturn-style), then nav + Proof.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { SpotlightTour, type SpotlightStep } from './SpotlightTour';

const STORAGE_KEY = 'engram-judge-tour-completed';

const JUDGE_TOUR_STEPS: SpotlightStep[] = [
  {
    id: 'orient',
    title: 'What to look for',
    description:
      'You are on Jordan\'s seeded journey (demo-user): real critiques, skill graduation, live MongoDB memory, and a reproducible benchmark. This tour spotlights each region — follow the glow.',
    tabHint: '90-second overview',
    placement: 'center',
  },
  {
    id: 'banner',
    title: 'Judge demo scope',
    description:
      'Track 1 · MemoryAgent — same Home / Work / Mentor UX as regular users, but data is scoped to the demo library and ?judge=1 stays in the URL as you move between tabs.',
    target: 'judge-banner',
    placement: 'bottom',
    tabHint: 'Top of Home',
  },
  {
    id: 'hero',
    title: 'Mentor read — identity',
    description:
      'The hero is the orientation surface: your mentor\'s read of this frame, current focus skill, and latest upload context. Identity lives here once — not repeated below.',
    target: 'home-hero',
    placement: 'bottom',
    tabHint: 'Home · Hero',
  },
  {
    id: 'threads',
    title: 'Memory threads',
    description:
      'Genre threads show score growth across your uploads — step through frames chronologically. Each dot is a real critiqued photo; captions tell the memory story (e.g. 5.9 → 7.5 on Landscape).',
    target: 'home-threads',
    placement: 'bottom',
    tabHint: 'Home · Threads',
  },
  {
    id: 'skills',
    title: 'Skill graduation',
    description:
      'Cleared skills stop getting beginner advice. Watching skills show streak dots — three strong uploads (7+ out of 10) in a row and the skill clears.',
    target: 'home-skills',
    placement: 'bottom',
    tabHint: 'Home · Skill progress',
  },
  {
    id: 'library',
    title: 'Library roll',
    description:
      'Your full critiqued roll, newest first — a contact sheet, not the memory story above. Tap any thumb to open that frame in My Work.',
    target: 'home-library',
    placement: 'top',
    tabHint: 'Home · Recent uploads',
  },
  {
    id: 'stats',
    title: 'At a glance',
    description:
      'Closing band: average scores, recent trend, practice assignments, and a portfolio-aware mentor sentence — with one tap into Mentor chat.',
    target: 'home-stats',
    placement: 'top',
    tabHint: 'Home · Stats',
  },
  {
    id: 'proof',
    title: 'Memory Proof Room',
    description:
      'Sidebar (desktop) or Proof tab (mobile): play Canon→Sony to watch stale facts retire, toggle MCP for the same stats through engram-mcp, and scan the FAMA benchmark.',
    target: 'nav-proof',
    placement: 'right',
    tabHint: 'Proof',
  },
  {
    id: 'work',
    title: 'Upload & Memory Receipt',
    description:
      'My Work: upload for Glass Box critique, then expand the Memory Receipt on any frame — recalled, retired, and dropped for token budget.',
    target: 'nav-work',
    placement: 'right',
    tabHint: 'My Work tab',
  },
  {
    id: 'practice',
    title: 'Practice Loop',
    description:
      'Practice proposes assignments grounded in skill state — accept a challenge, upload against the brief, and complete to see a skill delta receipt.',
    target: 'nav-practice',
    placement: 'right',
    tabHint: 'Practice tab',
  },
];

interface Props {
  forceShow?: boolean;
  onComplete?: () => void;
  onNavigateHome?: () => void;
}

export const JudgeTour: React.FC<Props> = ({
  forceShow,
  onComplete,
  onNavigateHome,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(Boolean(forceShow));
  }, [forceShow]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleComplete = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  }, [onComplete]);

  const handleStepChange = useCallback(
    (step: SpotlightStep) => {
      if (
        step.target?.startsWith('home-') ||
        step.target === 'judge-banner' ||
        step.target?.startsWith('nav-')
      ) {
        onNavigateHome?.();
      }
    },
    [onNavigateHome],
  );

  return (
    <SpotlightTour
      steps={JUDGE_TOUR_STEPS}
      isOpen={isOpen}
      onClose={handleClose}
      onComplete={handleComplete}
      onStepChange={handleStepChange}
      tourLabel="90-second walkthrough"
    />
  );
};

export function resetJudgeTour(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export default JudgeTour;
