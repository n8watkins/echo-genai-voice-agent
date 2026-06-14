'use client';

import { useEffect } from 'react';
import { MODELS, SHARED_MODEL } from '@/lib/gemini';
import { useModel } from '@/hooks/useModel';
import { useApiKey } from '@/hooks/useApiKey';

/**
 * Text/tool model selector for the Settings drawer. Lists every model; byok-
 * tier options are disabled (with a "needs your own key" badge) until the
 * visitor adds a BYOK key. If a byok model is selected and the key later goes
 * away, we snap back to the shared model so the next turn can't 503/downgrade
 * surprisingly. The server re-validates regardless.
 */
export default function ModelPicker() {
  const { model, setModel } = useModel();
  const { hasApiKey } = useApiKey();

  const selected = MODELS.find((m) => m.id === model);

  // Guard: if the active model needs a key and the key is gone, reset.
  useEffect(() => {
    if (!hasApiKey && selected && selected.tier === 'byok') {
      setModel(SHARED_MODEL);
    }
    // setModel is stable enough for this guard; deps kept minimal on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasApiKey, selected]);

  const activeBlurb = selected?.blurb;

  return (
    <div className="space-y-2" data-testid="model-picker">
      <label
        htmlFor="echo-model-select"
        className="block text-xs font-medium text-cyan-100/70"
      >
        Text & tool model
      </label>
      <div className="relative">
        <select
          id="echo-model-select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full appearance-none rounded-lg bg-white/5 border border-white/15 px-3 py-2 pr-8 text-sm text-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:bg-white/5"
        >
          {MODELS.map((m) => {
            const locked = m.tier === 'byok' && !hasApiKey;
            return (
              <option key={m.id} value={m.id} disabled={locked}>
                {m.label}
                {m.tier === 'byok' ? ' — needs your own key' : ''}
              </option>
            );
          })}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cyan-200/50 text-xs"
        >
          ▾
        </span>
      </div>

      {/* Per-option legend so the gate is obvious in the dropdown chrome too. */}
      <ul className="space-y-1">
        {MODELS.map((m) => {
          const locked = m.tier === 'byok' && !hasApiKey;
          return (
            <li
              key={m.id}
              className={`flex items-center gap-2 text-xs ${
                m.id === model ? 'text-cyan-200' : 'text-cyan-100/50'
              }`}
            >
              <span className="truncate">{m.label}</span>
              {m.tier === 'byok' && (
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${
                    locked
                      ? 'border-amber-400/40 text-amber-300/90'
                      : 'border-teal-400/40 text-teal-300/90'
                  }`}
                >
                  needs your own key
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {activeBlurb && <p className="text-xs text-cyan-100/50">{activeBlurb}</p>}
    </div>
  );
}
