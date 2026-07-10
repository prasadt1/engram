/**
 * UNWIRED (2026-07-10): Judge interstitial deleted — ?judge=1 lands directly on Home.
 * Orientation lives in the hero mentor-read, judge banner, and JudgeTour stop 0.
 * File kept for reversibility; restore from git history if needed.
 */

import React from 'react';

interface Props {
  onEnterDemo: () => void;
}

/** Not rendered from App.tsx — preserved stub only. */
export const JudgeWelcome: React.FC<Props> = () => null;

export default JudgeWelcome;
