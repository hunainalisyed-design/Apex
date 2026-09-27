"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  isSpeechRecognitionSupported,
  startRecognition,
  type RecognitionSession,
  type VoiceInputError,
} from "@/lib/voice/speechRecognition";
import { hasSeenVoiceNote, markVoiceNoteSeen } from "@/lib/voice/voicePreferences";

const noopSubscribe = () => () => {};

export interface UseVoiceInputResult {
  /** False on the server and in browsers without speech recognition (AC-1). */
  supported: boolean;
  listening: boolean;
  error: VoiceInputError | null;
  /** The one-time "your browser's speech service turns voice into text" note (Spec 34). */
  showPrivacyNote: boolean;
  /** Starts listening; what's heard is appended after `prefix` (whatever was already typed). */
  start: (prefix: string) => void;
  /** Stops listening and keeps what was heard. */
  stop: () => void;
  /** Stops listening and discards anything still on the way (e.g. on Send). */
  cancel: () => void;
}

/**
 * Tap-to-talk for the CarAI chat (Spec 34, AC-2): the words fill the message box as they're
 * heard; sending stays the user's own tap, exactly as if they'd typed it. Stops by itself when
 * the component unmounts (the chat closing).
 */
export function useVoiceInput(onTranscript: (text: string) => void): UseVoiceInputResult {
  const supported = useSyncExternalStore(noopSubscribe, isSpeechRecognitionSupported, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceInputError | null>(null);
  const [showPrivacyNote, setShowPrivacyNote] = useState(false);
  const session = useRef<RecognitionSession | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const start = useCallback((prefix: string) => {
    if (session.current) return;
    setError(null);
    const firstTime = !hasSeenVoiceNote();
    if (firstTime) setShowPrivacyNote(true);
    const lead = prefix.trim();
    const started = startRecognition({
      lang: DEFAULT_LOCALE,
      onTranscript: (text) => onTranscriptRef.current(lead ? `${lead} ${text}` : text),
      onError: (kind) => setError(kind),
      onEnd: () => {
        session.current = null;
        setListening(false);
        if (firstTime) markVoiceNoteSeen();
      },
    });
    if (started) {
      session.current = started;
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => session.current?.stop(), []);
  const cancel = useCallback(() => session.current?.abort(), []);

  // The chat closing (this unmounting) ends any session — never left listening in the background.
  useEffect(() => () => session.current?.abort(), []);

  return { supported, listening, error, showPrivacyNote, start, stop, cancel };
}
