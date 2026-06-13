'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PERSONAS,
  DEFAULT_PERSONA_ID,
  PERSONA_STORAGE_KEY,
  getPersona,
  type Persona,
} from '@/lib/personas';

/**
 * Active-persona state, persisted in localStorage (`echo_persona`). Selecting a
 * persona only changes the system-prompt text sent to /api/chat plus the shown
 * voice hint and starter prompts — no extra model calls.
 */
export function usePersona() {
  const [personaId, setPersonaId] = useState<string>(DEFAULT_PERSONA_ID);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERSONA_STORAGE_KEY);
      if (saved && PERSONAS.some((p) => p.id === saved)) {
        setPersonaId(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const selectPersona = useCallback((id: string) => {
    setPersonaId(id);
    try {
      localStorage.setItem(PERSONA_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const persona: Persona = getPersona(personaId);

  return { persona, personaId, selectPersona, personas: PERSONAS };
}
