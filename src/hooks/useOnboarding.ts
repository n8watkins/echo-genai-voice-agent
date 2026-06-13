'use client';

import { useCallback, useEffect, useState } from 'react';

export const ONBOARDING_COMPLETE_KEY = 'echo_onboarding_complete';

/** Pure check so the first-run rule is testable. */
export function isOnboardingComplete(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(ONBOARDING_COMPLETE_KEY) !== null;
}

/**
 * First-run-only onboarding wizard state. Shows exactly once; completing or
 * dismissing it sets a localStorage flag.
 */
export function useOnboarding() {
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    try {
      if (!isOnboardingComplete(localStorage)) setShowWizard(true);
    } catch {
      // localStorage unavailable: never block the app
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch {
      /* best effort */
    }
    setShowWizard(false);
  }, []);

  const reopenOnboarding = useCallback(() => setShowWizard(true), []);

  return { showWizard, completeOnboarding, reopenOnboarding };
}
