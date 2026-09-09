"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  /** Focus moves here when the trap closes via Escape (Spec 13, AC-5 — the nav's mobile
   * menu must return focus to its hamburger toggle). Omit to leave focus wherever the
   * browser puts it by default, matching this hook's original CaptureBuild behavior. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

/** Traps Tab/Shift+Tab focus cycling within containerRef while isOpen, moves focus to the
 * first focusable element on open, and calls onDismiss on Escape. Generalized from
 * CaptureBuild's hand-rolled version (Spec 11) now that Nav's mobile menu (Spec 13) needs
 * the identical behavior — one shared implementation instead of two near-duplicates. */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: () => void,
  options?: UseFocusTrapOptions,
): void {
  const returnFocusTo = options?.returnFocusTo;

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    focusables()[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
        returnFocusTo?.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onDismiss, containerRef, returnFocusTo]);
}
