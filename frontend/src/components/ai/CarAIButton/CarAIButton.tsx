import { forwardRef } from "react";
import { useCarAiChatStore } from "@/state/carAiChatStore";

/** The floating AI toggle (Spec 15, AC-1) — a real, focusable button styled per SRS §21's
 * dark/glassmorphism language. Forwards its ref so the chat window's focus trap can return
 * focus here on Escape (AC-10). No aria-hidden on the glyph: the button's own aria-label
 * already determines its accessible name, and a stray aria-hidden span risks colliding with
 * e2e locators elsewhere that key off that exact attribute (the same lesson learned when
 * building Nav's hamburger toggle, Spec 13). */
export const CarAIButton = forwardRef<HTMLButtonElement>(function CarAIButton(_props, ref) {
  const isOpen = useCarAiChatStore((s) => s.isOpen);
  const setOpen = useCarAiChatStore((s) => s.setOpen);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setOpen(!isOpen)}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Close CarAI assistant" : "Ask CarAI"}
      className="glass-panel focus-ring fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg transition hover:bg-white/10"
    >
      {isOpen ? "✕" : "✨"}
    </button>
  );
});
