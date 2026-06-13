'use client';

import { type UsageInfo, poolPercentUsed, formatPoolReset } from '@/hooks/useUsageInfo';

/**
 * Shared demo-pool capacity meter. Renders a friendly placeholder until the
 * first snapshot arrives. Reskinned cyan from gemini-chat-app.
 */
export function PoolMeterBar({ usage }: { usage: UsageInfo | null }) {
  if (!usage?.pool || usage.pool.budget <= 0) {
    return (
      <div data-testid="pool-meter" data-state="placeholder">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-cyan-100">Shared demo pool</span>
          <span className="text-cyan-200/60">checking…</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div className="h-full w-1/3 bg-cyan-400/60 animate-pulse rounded-full" />
        </div>
        <p className="text-xs mt-1 text-cyan-200/60">
          You can talk right away — live capacity will appear here.
        </p>
      </div>
    );
  }

  const pctUsed = poolPercentUsed(usage);
  const pctLeft = 100 - pctUsed;
  const exhausted = usage.pool.available <= 0;
  const barColor =
    exhausted || pctUsed >= 90 ? 'bg-rose-400' : pctUsed >= 70 ? 'bg-amber-400' : 'bg-teal-400';
  const reset = formatPoolReset(usage.pool.resetAt);

  return (
    <div data-testid="pool-meter" data-state={exhausted ? 'exhausted' : 'ok'}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-cyan-100">Shared demo pool</span>
        <span className="font-mono text-cyan-100">{pctLeft}% left</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full transition-all duration-300 ${barColor}`} style={{ width: `${Math.max(pctUsed, 2)}%` }} />
      </div>
      <p className="text-xs mt-1 text-cyan-200/60">
        {exhausted
          ? `Demo capacity used up${reset ? ` — resets ${reset}` : ''}. Add your own free key to keep talking.`
          : reset
            ? `Resets ${reset}`
            : 'Everyone shares this free demo budget'}
      </p>
    </div>
  );
}
