'use client';

import { useEffect, useRef } from 'react';

/**
 * Focus management for modal-style overlays (drawers/dialogs that set
 * aria-modal). While `active`, it:
 *   - moves focus into the container,
 *   - traps Tab / Shift+Tab within the focusable elements,
 *   - restores focus to the previously-focused element on close.
 *
 * Esc handling stays with the caller (each drawer already wires its own close).
 * Returns a ref to attach to the container element.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Move focus into the drawer (first focusable, else the container itself).
    const initial = focusables()[0] ?? container;
    initial.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Restore focus to whatever was focused before the drawer opened.
      restoreRef.current?.focus?.();
    };
  }, [active]);

  return containerRef;
}
