import React from 'react';
import Image from 'next/image';
import {
  MicrophoneIcon,
  ArrowUturnLeftIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  KeyIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';

/**
 * Shared "what is this project" content, used by the onboarding wizard (step 1)
 * and the About modal. Mirrors gemini-chat-app's structure, reskinned cyan/teal
 * for Echo and rewritten for the voice-agent feature set (plan §8).
 */
const AboutContent: React.FC = () => {
  return (
    <div>
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-white text-3xl font-bold mb-4">Welcome to Echo</h2>
      </div>

      {/* Intro with portrait + bio + socials */}
      <div className="bg-gradient-to-br from-cyan-900/30 to-teal-900/30 p-5 rounded-xl border border-cyan-500/30 mb-5">
        <div className="flex flex-col items-center gap-4 mb-4">
          <Image
            src="/images/portrait-medium.jpg"
            alt="Nathan's Portrait"
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover border-2 border-cyan-400 shadow-md"
          />
          <div className="text-center">
            <p className="text-cyan-50/90 text-sm leading-relaxed">
              I&apos;m Nathan, and Echo is a portfolio project exploring what it takes to make a
              voice agent feel <em>alive</em> instead of like a walkie-talkie. It showcases
              real-time streaming, turn-taking, and barge-in. I hope you enjoy it — and if
              you&apos;d like to explore further:
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <ul className="space-y-2 text-cyan-50/90 text-sm">
            <li className="flex items-start space-x-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              <span>
                Share feedback or report issues on{' '}
                <a
                  href="https://github.com/n8watkins"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 underline hover:no-underline font-semibold"
                >
                  GitHub
                </a>
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              <span>
                Check out my{' '}
                <a
                  href="https://n8sportfolio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 underline hover:no-underline font-semibold"
                >
                  Portfolio page
                </a>{' '}
                for more projects
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              <span>Feel free to connect with me on my socials</span>
            </li>
          </ul>

          {/* Social links row */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href="https://github.com/n8watkins"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="w-8 h-8 rounded-full bg-cyan-600 hover:bg-cyan-500 transition-all flex items-center justify-center shadow-sm"
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/n8watkins/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="w-8 h-8 rounded-full bg-cyan-600 hover:bg-cyan-500 transition-all flex items-center justify-center shadow-sm"
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://x.com/n8watkins"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="w-8 h-8 rounded-full bg-cyan-600 hover:bg-cyan-500 transition-all flex items-center justify-center shadow-sm"
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://n8sportfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xs font-semibold rounded-full shadow-sm hover:from-cyan-400 hover:to-teal-400 transition-all"
            >
              Portfolio
            </a>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="space-y-4">
        <div>
          <h3 className="text-white text-lg font-bold mb-3 text-center">🌟 Key Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Feature
              icon={<MicrophoneIcon className="w-6 h-6 text-cyan-400" />}
              title="Real-time voice"
              desc="Speak naturally and hear a reply in about a second."
              tint="cyan"
            />
            <Feature
              icon={<ArrowUturnLeftIcon className="w-6 h-6 text-rose-400" />}
              title="Interrupt anytime"
              desc="Talk over Echo and it stops and listens — true barge-in."
              tint="rose"
            />
            <Feature
              icon={<BoltIcon className="w-6 h-6 text-teal-400" />}
              title="Speaks as it thinks"
              desc="Starts talking on the first sentence, not the last."
              tint="teal"
            />
            <Feature
              icon={<WrenchScrewdriverIcon className="w-6 h-6 text-amber-400" />}
              title="Voice tools"
              desc="Ask for weather, time zones, or a quick web lookup mid-conversation."
              tint="amber"
            />
            <Feature
              icon={<KeyIcon className="w-6 h-6 text-emerald-400" />}
              title="Free to try, BYOK optional"
              desc="No key needed — speech-to-text and text-to-speech run in your browser."
              tint="emerald"
            />
            <Feature
              icon={<CodeBracketIcon className="w-6 h-6 text-cyan-300" />}
              title="Open source on GitHub"
              desc="Full source available — fork it, read the turn-taking state machine."
              tint="slate"
            />
          </div>
        </div>

        {/* Under the hood */}
        <div className="bg-gradient-to-br from-gray-800/60 to-slate-800/60 p-4 rounded-xl border border-white/10">
          <h3 className="text-white text-base font-bold mb-3 text-center">⚡ Under the hood</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Column
              label="Latency"
              color="text-cyan-400"
              items={['Sentence-level streaming TTS', 'SSE token stream', 'First word in ~800ms']}
            />
            <Column
              label="Turn-taking"
              color="text-teal-400"
              items={['State-machine turn logic', 'Barge-in cancel', 'Push-to-talk default']}
            />
            <Column
              label="Privacy"
              color="text-rose-400"
              items={['Speech never leaves your browser for STT/TTS', 'Key stored locally only', 'Ephemeral transcripts']}
            />
          </div>
        </div>

        {/* Tech stack */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-teal-900/20 p-3 rounded-xl">
          <h3 className="text-white text-sm font-bold mb-2 text-center">🛠️ Tech Stack</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {['TypeScript', 'Next.js 16', 'React 19', 'Tailwind CSS', 'Gemini AI', 'Web Speech API', 'SSE'].map(
              (t) => (
                <span
                  key={t}
                  className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-cyan-50 shadow-sm"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </div>

        {/* Footer idiom */}
        <div className="p-4 bg-white/5 rounded-xl border border-cyan-500/20">
          <p className="text-cyan-50/80 text-sm">
            <span className="font-semibold text-cyan-300">Portfolio project showcasing:</span>{' '}
            Next.js 16 + TypeScript + Gemini streaming + Web Speech API + real-time turn-taking
          </p>
        </div>
      </div>
    </div>
  );
};

function Feature({
  icon,
  title,
  desc,
  tint,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tint: 'cyan' | 'rose' | 'teal' | 'amber' | 'emerald' | 'slate';
}) {
  const border: Record<string, string> = {
    cyan: 'border-cyan-500/30 bg-cyan-500/10',
    rose: 'border-rose-500/30 bg-rose-500/10',
    teal: 'border-teal-500/30 bg-teal-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    slate: 'border-white/15 bg-white/5',
  };
  return (
    <div className={`flex items-start space-x-3 p-3 rounded-lg border ${border[tint]}`}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-cyan-100/70">{desc}</p>
      </div>
    </div>
  );
}

function Column({ label, color, items }: { label: string; color: string; items: string[] }) {
  return (
    <div>
      <p className={`text-xs font-bold mb-2 ${color}`}>{label}</p>
      <ul className="text-xs space-y-1.5 text-cyan-100/80">
        {items.map((i) => (
          <li key={i} className="flex items-start space-x-1.5">
            <span className={`font-bold mt-0.5 ${color}`}>✓</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AboutContent;
