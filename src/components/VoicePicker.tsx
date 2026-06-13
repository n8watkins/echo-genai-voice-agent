'use client';

import { SpeakerWaveIcon } from '@heroicons/react/24/outline';
import type { useSpeech } from '@/hooks/useSpeech';

type SpeechApi = ReturnType<typeof useSpeech>;

/**
 * Voice + rate/pitch picker for browser speechSynthesis. Local voices are
 * robotic by design; the panel notes cloud TTS as the upgrade path.
 */
export default function VoicePicker({ speech }: { speech: SpeechApi }) {
  if (!speech.supported) {
    return (
      <p className="text-xs text-cyan-200/50">
        Speech output isn&apos;t available in this browser. Captions still show Echo&apos;s replies.
      </p>
    );
  }

  const recommended = speech.voices.filter((v) => v.recommended);
  const others = speech.voices.filter((v) => !v.recommended);

  const renderOption = (v: SpeechApi['voices'][number]) => (
    <option key={v.voiceURI} value={v.voiceURI} className="bg-gray-900">
      {v.name} ({v.lang}){v.localService ? '' : ' · cloud'}
    </option>
  );

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-cyan-200/80 mb-1">
          <SpeakerWaveIcon className="w-4 h-4" /> Voice
        </label>
        <select
          value={speech.selectedURI ?? ''}
          onChange={(e) => speech.selectVoice(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
        >
          {recommended.length > 0 ? (
            <>
              <optgroup label="Recommended" className="bg-gray-900">
                {recommended.map(renderOption)}
              </optgroup>
              {others.length > 0 && (
                <optgroup label="All voices" className="bg-gray-900">
                  {others.map(renderOption)}
                </optgroup>
              )}
            </>
          ) : (
            speech.voices.map(renderOption)
          )}
        </select>
        <p className="text-[11px] text-cyan-200/40 mt-1 leading-snug">
          Recommended voices are higher-quality (Natural, Neural, Google, or online voices).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-cyan-200/70">Rate {speech.rate.toFixed(1)}</span>
          <input
            type="range"
            min={0.5}
            max={1.6}
            step={0.1}
            value={speech.rate}
            onChange={(e) => speech.setRate(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </label>
        <label className="block">
          <span className="text-xs text-cyan-200/70">Pitch {speech.pitch.toFixed(1)}</span>
          <input
            type="range"
            min={0.5}
            max={1.6}
            step={0.1}
            value={speech.pitch}
            onChange={(e) => speech.setPitch(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </label>
      </div>

      <button
        onClick={speech.preview}
        className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
      >
        ▶ Preview voice
      </button>
      <p className="text-[11px] text-cyan-200/40 leading-snug">
        Free browser voices, auto-tuned to your active persona. Quality varies by OS — Chrome and
        recent macOS/Windows ship the nicest neural voices.
      </p>
    </div>
  );
}
