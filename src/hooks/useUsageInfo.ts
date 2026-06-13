'use client';

import { useEffect, useState } from 'react';

export interface UsageInfo {
  pool: {
    used: number;
    budget: number;
    resetAt: string | number | null;
    available: number;
  };
  user?: { requests: number; tokens: number };
}

/** Fetches the shared demo-pool snapshot once per mount. Degrades to null. */
export function useUsageInfo(): UsageInfo | null {
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.pool) setUsage(data as UsageInfo);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return usage;
}

export function poolPercentUsed(usage: UsageInfo | null): number {
  if (!usage?.pool || usage.pool.budget <= 0) return 0;
  const pct = (usage.pool.used / usage.pool.budget) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function formatPoolReset(resetAt: string | number | null | undefined): string {
  if (resetAt === null || resetAt === undefined || resetAt === '') return '';
  const date = new Date(resetAt);
  if (isNaN(date.getTime())) return '';
  const deltaMs = date.getTime() - Date.now();
  if (deltaMs <= 0) return 'soon';
  const minutes = Math.ceil(deltaMs / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `in ${hours}h ${minutes % 60}m`;
}
