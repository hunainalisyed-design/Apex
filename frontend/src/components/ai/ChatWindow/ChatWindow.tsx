"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { RecommendationCard } from "@/components/ai/RecommendationCard/RecommendationCard";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useIsDesktopViewport } from "@/hooks/useIsDesktopViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";
import { useCarAiChatStore, type ChatMessage } from "@/state/carAiChatStore";
import type { VehicleDetailDto } from "@/types/catalog";

const MAX_MESSAGE_LENGTH = 500;

const EXAMPLE_PROMPTS = ["Make it sportier", "I want an elegant daily driver", "Add some carbon trim"];

export interface ChatWindowProps {
  vehicle: VehicleDetailDto;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

function bubbleClassName(role: ChatMessage["role"]): string {
  if (role === "user") return "self-end bg-white text-black";
  if (role === "system-error") return "self-start bg-red-500/20 text-red-100";
  return "self-start bg-white/10 text-white";
}

/**
 * The chat panel (Spec 15). role="dialog" without aria-modal="true" and with no
 * full-viewport backdrop, unlike CaptureBuild's success-modal precedent — a floating
 * assistant isn't meant to block the rest of the page (the user should be able to watch
 * the 3D scene update while chatting), so this is a corner-anchored floating panel on
 * desktop, switching to a genuine full-screen sheet only below the `lg` breakpoint (AC-12).
 */
export function ChatWindow({ vehicle, buttonRef }: ChatWindowProps) {
  const isOpen = useCarAiChatStore((s) => s.isOpen);
  const isLoading = useCarAiChatStore((s) => s.isLoading);
  const messages = useCarAiChatStore((s) => s.messages);
  const setOpen = useCarAiChatStore((s) => s.setOpen);
  const sendMessage = useCarAiChatStore((s) => s.sendMessage);
  const applyRecommendation = useCarAiChatStore((s) => s.applyRecommendation);

  const reducedMotion = useReducedMotion();
  const isDesktop = useIsDesktopViewport();
  const [draft, setDraft] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const close = () => setOpen(false);

  useFocusTrap(containerRef, isOpen, close, { returnFocusTo: buttonRef });

  // AC-10 wants focus specifically on the message input, not just "the first focusable
  // element" (which would be the header's close button, given DOM order) — declared after
  // useFocusTrap so this effect runs after its own auto-focus-first-element effect on the
  // same commit and deterministically wins. Deliberate, not a bug: don't "simplify" away.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }, [messages, reducedMotion]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    setDraft("");
    void sendMessage(trimmed);
  }

  const positionClassName = isDesktop
    ? "fixed bottom-24 right-6 z-50 flex h-[32rem] w-96 flex-col"
    : "fixed inset-0 z-50 flex flex-col";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          role="dialog"
          aria-labelledby={titleId}
          // Not the standard `glass-panel` utility: at glass-panel's usual 4% background
          // opacity, this window (which overlaps the busy, text-heavy configurator panel
          // behind it on desktop) let that panel's own text show through the blur, making
          // both illegible. A near-opaque background reading as "the page's own dark
          // theme, solid" avoids that while keeping the blur for edge bleed-through.
          className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl ${positionClassName}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: withReducedMotion(reducedMotion, 0.2, 0) }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
              Ask CarAI
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close CarAI assistant"
              className="focus-ring text-white/50 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2 text-sm text-white/60">
                <p>Tell me what you&apos;re looking for, and I&apos;ll recommend a build for {vehicle.name}.</p>
                <ul className="flex flex-col gap-1 text-xs text-white/40">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <li key={prompt}>&quot;{prompt}&quot;</li>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="flex flex-col gap-2">
                <p className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${bubbleClassName(message.role)}`}>
                  {message.content}
                </p>
                {message.recommendation && message.breakdown && (
                  <RecommendationCard
                    recommendation={message.recommendation}
                    breakdown={message.breakdown}
                    applied={message.applied ?? false}
                    onApply={() => applyRecommendation(message.id)}
                  />
                )}
              </div>
            ))}

            {isLoading && (
              <p className="self-start rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/60">
                CarAI is thinking…
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-white/10 p-3">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={isLoading}
              placeholder="Ask CarAI to configure your build…"
              className="focus-ring flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !draft.trim()}
              className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
