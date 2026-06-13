'use client';

import { useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';

/**
 * Compact "bring your own free Gemini key" form. Reskinned cyan from
 * gemini-chat-app. The key is stored only in the browser.
 */
export default function InlineKeyEntry({ onSaved }: { onSaved?: () => void }) {
  const { hasApiKey, saveApiKey, removeApiKey } = useApiKey();
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if (!value.trim()) {
      setError('Please paste your API key first.');
      return;
    }
    try {
      saveApiKey(value);
      setValue('');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the key.');
    }
  };

  return (
    <div className="space-y-3" data-testid="inline-key-entry">
      {hasApiKey && (
        <div className="flex items-center justify-between gap-2 text-sm text-emerald-300">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full" />
            Your key is active — unlimited use.
          </span>
          <button onClick={removeApiKey} className="text-xs text-cyan-300 hover:text-cyan-200 underline">
            Remove
          </button>
        </div>
      )}

      <ol className="text-sm text-cyan-100/70 space-y-1 list-decimal list-inside">
        <li>
          Open{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 hover:underline font-medium"
          >
            Google AI Studio
          </a>{' '}
          (free, ~2 minutes)
        </li>
        <li>Click &quot;Create API Key&quot;</li>
        <li>Paste it below — it stays in your browser, never on our servers.</li>
      </ol>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="AIza... or AQ...."
            className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border border-white/15 text-cyan-50 placeholder-cyan-200/30 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-200/60 hover:text-cyan-100 text-xs"
          >
            {show ? 'hide' : 'show'}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!value.trim()}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-teal-400 transition"
        >
          {hasApiKey ? 'Update' : 'Save key'}
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
