// Flat ESLint config (ESLint 9 + Next 16). `next lint` was removed in Next 16,
// so we run ESLint directly: `eslint .` (see package.json "lint").
import next from 'eslint-config-next';
import nextTs from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  ...next,
  ...nextTs,
  {
    rules: {
      // The React Compiler rules bundled with eslint-plugin-react-hooks v6 are
      // still experimental and flag legitimate, intentional patterns here:
      // lazy-initializing state from localStorage in an effect, orchestrating
      // enter/leave animation timing, and mutating instance refs (recognizer /
      // speech-synthesis utterance handlers) inside effects/callbacks. We keep
      // the high-signal Next rules and switch off these specific noisy ones.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
    },
  },
];

export default config;
