'use client';

import { SpeakerWaveIcon } from '@heroicons/react/24/outline';
import type { useSpeech } from '@/hooks/useSpeech';

type SpeechApi = ReturnType<typeof useSpeech>;

/**
 * Compact voice quick-select for the top bar. Lists recommended voices (falls
 * back to all) and reuses the same useSpeech data — full controls (rate/pitch,
 * all voices, preview) live in the settings drawer's VoicePicker.
 */
export default function VoiceQuickSelect({ speech }: { speech: SpeechApi }) {
  if (!speech.supported || speech.voices.length === 0) return null;

  const recommended = speech.voices.filter((v) => v.recommended);
  const list = recommended.length > 0 ? recommended : speech.voices;

  return (
    <label className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-white/5 pl-2 pr-1 py-1 text-cyan-50 hover:border-cyan-500/40 transition">
      <SpeakerWaveIcon className="w-4 h-4 text-cyan-200/60 flex-shrink-0" aria-hidden />
      <span className="sr-only">Voice</span>
      <select
        value={speech.selectedURI ?? ''}
        onChange={(e) => speech.selectVoice(e.target.value)}
        aria-label="Quick voice select"
        className="max-w-[9rem] bg-transparent text-xs text-cyan-50 focus:outline-none cursor-pointer"
      >
        {list.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI} className="bg-gray-900">
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}
