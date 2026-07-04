const ONBOARDING_KEY = 'iris_onboarding_done';

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function setOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

export function clearOnboardingComplete(): void {
  localStorage.removeItem(ONBOARDING_KEY);
}

/** True when persona was saved on the server (e.g. iOS demo or a prior web visit). */
export function serverOnboardingComplete(
  preferences: Record<string, unknown> | undefined
): boolean {
  return preferences?.onboardingComplete === true;
}
