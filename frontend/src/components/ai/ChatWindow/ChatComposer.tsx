"use client";

import { useTranslations } from "next-intl";
import type { FormEvent, RefObject } from "react";
import { useVoiceInput } from "./useVoiceInput";

export const MAX_MESSAGE_LENGTH = 500;

export interface ChatComposerProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: (text: string) => void;
  isLoading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

/**
 * The chat's message box, Send button, and — where the browser supports it — the microphone
 * (Spec 34). Spoken words land in the same box as typed ones and go out through the same
 * Send (AC-2), so the backend and recommendation pipeline can't tell them apart. When voice
 * fails, a short note says why and typing carries on as normal (AC-5).
 */
export function ChatComposer({ draft, onDraftChange, onSubmit, isLoading, inputRef }: ChatComposerProps) {
  const t = useTranslations("carai");
  const voice = useVoiceInput((text) => onDraftChange(text.slice(0, MAX_MESSAGE_LENGTH)));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    voice.cancel();
    onSubmit(trimmed);
  }

  function toggleListening() {
    if (voice.listening) {
      voice.stop();
    } else {
      voice.start(draft);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="border-t border-white/10 p-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={isLoading}
          placeholder={t("placeholder")}
          className="focus-ring flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-60"
        />
        {voice.supported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={isLoading}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? t("voice.stop") : t("voice.start")}
            title={voice.listening ? t("voice.stop") : t("voice.start")}
            className={`focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
              voice.listening ? "bg-red-500 text-white" : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            }`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <path d="M12 17v5" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || !draft.trim()}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("send")}
        </button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-1">
        {voice.listening && (
          <p className="mt-2 flex items-center gap-2 text-xs text-white/70" data-testid="voice-listening">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse" />
            {t("voice.listening")}
          </p>
        )}
        {voice.showPrivacyNote && <p className="mt-1 text-[11px] text-white/45">{t("voice.privacyNote")}</p>}
      </div>
      {voice.error && (
        <p role="alert" className="mt-2 text-xs text-amber-200">
          {t(`voice.errors.${voice.error}`)}
        </p>
      )}
    </div>
  );
}
