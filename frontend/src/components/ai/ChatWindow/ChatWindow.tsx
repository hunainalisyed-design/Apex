"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { RecommendationCard } from "@/components/ai/RecommendationCard/RecommendationCard";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useIsDesktopViewport } from "@/hooks/useIsDesktopViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";
import {
  cancelSpeech,
  getServerSpeakingId,
  getSpeakingId,
  isSpeechSynthesisSupported,
  speak,
  subscribeToSpeaking,
} from "@/lib/voice/speechSynthesis";
import {
  getServerSpeakRepliesSnapshot,
  getSpeakRepliesSnapshot,
  setSpeakReplies,
  subscribeToSpeakReplies,
} from "@/lib/voice/voicePreferences";
import { useCarAiChatStore, type ChatMessage } from "@/state/carAiChatStore";
import type { VehicleDetailDto } from "@/types/catalog";
import { ChatComposer } from "./ChatComposer";

const EXAMPLE_PROMPT_KEYS = ["example1", "example2", "example3"] as const;

const noopSubscribe = () => () => {};

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
 *
 * Spec 34 adds voice: a microphone in the composer (ChatComposer), and an optional "speak
 * replies" switch in the header that reads each new CarAI reply aloud — off by default and
 * remembered on this device (AC-3/AC-4), stoppable mid-sentence from the reply itself.
 */
export function ChatWindow({ vehicle, buttonRef }: ChatWindowProps) {
  const t = useTranslations("carai");
  const isOpen = useCarAiChatStore((s) => s.isOpen);
  const isLoading = useCarAiChatStore((s) => s.isLoading);
  const messages = useCarAiChatStore((s) => s.messages);
  const setOpen = useCarAiChatStore((s) => s.setOpen);
  const sendMessage = useCarAiChatStore((s) => s.sendMessage);
  const applyRecommendation = useCarAiChatStore((s) => s.applyRecommendation);

  const reducedMotion = useReducedMotion();
  const isDesktop = useIsDesktopViewport();
  const [draft, setDraft] = useState("");

  const canSpeak = useSyncExternalStore(noopSubscribe, isSpeechSynthesisSupported, () => false);
  const speakReplies = useSyncExternalStore(subscribeToSpeakReplies, getSpeakRepliesSnapshot, getServerSpeakRepliesSnapshot);
  const speakingId = useSyncExternalStore(subscribeToSpeaking, getSpeakingId, getServerSpeakingId);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Replies already in the chat when it mounts are never read out — only new ones.
  const lastHandledId = useRef<string | undefined>(messages.at(-1)?.id);

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

  // Spec 34, AC-3: read each NEW CarAI reply aloud while "speak replies" is on. Errors aren't read.
  useEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id === lastHandledId.current) return;
    lastHandledId.current = last.id;
    if (speakReplies && isOpen && last.role === "assistant") speak(last.id, last.content, DEFAULT_LOCALE);
  }, [messages, speakReplies, isOpen]);

  // Closing the chat (or leaving the page) stops any reply being read.
  useEffect(() => {
    if (!isOpen) cancelSpeech();
  }, [isOpen]);
  useEffect(() => () => cancelSpeech(), []);

  function handleSend(text: string) {
    cancelSpeech();
    setDraft("");
    void sendMessage(text);
  }

  function toggleSpeakReplies() {
    if (speakReplies) cancelSpeech();
    setSpeakReplies(!speakReplies);
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
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
              {t("title")}
            </h2>
            <div className="flex items-center gap-3">
              {canSpeak && (
                <button
                  type="button"
                  onClick={toggleSpeakReplies}
                  aria-pressed={speakReplies}
                  aria-label={t("speakReplies")}
                  title={t("speakReplies")}
                  className={`focus-ring rounded-full p-1 transition ${speakReplies ? "text-white" : "text-white/40 hover:text-white"}`}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    {speakReplies ? (
                      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
                    ) : (
                      <path d="m22 9-6 6M16 9l6 6" />
                    )}
                  </svg>
                </button>
              )}
              <button type="button" onClick={close} aria-label={t("close")} className="focus-ring text-white/50 hover:text-white">
                ✕
              </button>
            </div>
          </div>

          <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2 text-sm text-white/60">
                <p>{t("intro", { vehicle: vehicle.name })}</p>
                <ul className="flex flex-col gap-1 text-xs text-white/40">
                  {EXAMPLE_PROMPT_KEYS.map((key) => (
                    <li key={key}>&quot;{t(key)}&quot;</li>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="flex flex-col gap-2">
                <p className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${bubbleClassName(message.role)}`}>
                  {message.content}
                </p>
                {speakingId === message.id && (
                  <div className="flex items-center gap-2 self-start text-xs text-white/60" data-testid="speaking-indicator">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
                    {t("speaking")}
                    <button type="button" onClick={cancelSpeech} className="focus-ring rounded-full border border-white/20 px-2 py-0.5 text-white/80 hover:text-white">
                      {t("stopSpeaking")}
                    </button>
                  </div>
                )}
                {message.recommendation && message.breakdown && (
                  <RecommendationCard
                    recommendation={message.recommendation}
                    breakdown={message.breakdown}
                    applied={message.applied ?? false}
                    onApply={() => applyRecommendation(message.id)}
                    messageId={message.id}
                    vehicleSlug={vehicle.slug}
                  />
                )}
              </div>
            ))}

            {isLoading && <p className="self-start rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/60">{t("thinking")}</p>}
          </div>

          <ChatComposer draft={draft} onDraftChange={setDraft} onSubmit={handleSend} isLoading={isLoading} inputRef={inputRef} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
