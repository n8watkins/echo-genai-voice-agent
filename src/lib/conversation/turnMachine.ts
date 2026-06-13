/**
 * Turn-taking state machine. The heart of "feels alive": explicit states,
 * not booleans scattered around the orchestrator.
 *
 *   idle ──(mic on)──▶ listening
 *   listening ──(final transcript)──▶ thinking
 *   thinking ──(first sentence ready)──▶ speaking
 *   speaking ──(speech ends)──▶ listening      (hands-free) | idle (push-to-talk)
 *   speaking ──(user starts talking = BARGE-IN)──▶ listening
 *   any ──(mic off / stop)──▶ idle
 *   any ──(error)──▶ idle
 */

export type TurnState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type TurnEvent =
  | { type: 'MIC_ON' }
  | { type: 'MIC_OFF' }
  | { type: 'FINAL_TRANSCRIPT' }
  | { type: 'FIRST_SENTENCE' }
  | { type: 'SPEECH_END' }
  | { type: 'BARGE_IN' }
  | { type: 'ERROR' };

export interface TransitionContext {
  /** In hands-free mode, finishing speech loops back to listening. */
  handsFree: boolean;
}

/**
 * Pure reducer. Returns the next state given the current state + event.
 * Unhandled (state, event) pairs are no-ops (return the same state), which
 * keeps the orchestrator resilient to out-of-order async callbacks.
 */
export function transition(
  state: TurnState,
  event: TurnEvent,
  ctx: TransitionContext
): TurnState {
  // Global transitions available from any state.
  if (event.type === 'MIC_OFF') return 'idle';
  if (event.type === 'ERROR') return 'idle';

  switch (state) {
    case 'idle':
      if (event.type === 'MIC_ON') return 'listening';
      return state;

    case 'listening':
      if (event.type === 'FINAL_TRANSCRIPT') return 'thinking';
      return state;

    case 'thinking':
      if (event.type === 'FIRST_SENTENCE') return 'speaking';
      // If the model produced nothing speakable, fall back to listening.
      if (event.type === 'SPEECH_END') return ctx.handsFree ? 'listening' : 'idle';
      return state;

    case 'speaking':
      if (event.type === 'BARGE_IN') return 'listening';
      if (event.type === 'SPEECH_END') return ctx.handsFree ? 'listening' : 'idle';
      return state;

    default:
      return state;
  }
}
