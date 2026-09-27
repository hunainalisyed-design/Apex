/**
 * Speech-to-text for CarAI (Spec 34), via the browser's Web Speech API. Not every browser has
 * it (notably Firefox), so everything here is progressive enhancement: callers check
 * `isSpeechRecognitionSupported()` and simply offer typing alone when it's false (AC-1).
 *
 * The minimal typings below cover what we use — TypeScript's DOM lib doesn't ship
 * SpeechRecognition, and Chrome/Edge still expose it only as `webkitSpeechRecognition`.
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResultLike };
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/** What went wrong, in the terms the chat explains to the user (AC-5). */
export type VoiceInputError = "denied" | "noMicrophone" | "noSpeech" | "unavailable";

/**
 * Maps the Web Speech API's error codes to a user-facing kind; null for "aborted", which is
 * us stopping it on purpose, not a failure.
 */
export function mapRecognitionError(code: string): VoiceInputError | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "audio-capture":
      return "noMicrophone";
    case "no-speech":
      return "noSpeech";
    default:
      return "unavailable"; // "network", "language-not-supported", "bad-grammar", unknown
  }
}

/** Everything heard so far in this session, interim words included, as one string. */
export function transcriptOf(event: SpeechRecognitionEventLike): string {
  let text = "";
  for (let i = 0; i < event.results.length; i++) text += event.results[i][0]?.transcript ?? "";
  return text.trim();
}

export interface RecognitionSession {
  /** Stop listening and keep what was heard. */
  stop: () => void;
  /** Stop listening and discard any result still on the way. */
  abort: () => void;
}

export interface StartRecognitionOptions {
  lang: string;
  /** Called with the full transcript so far, as words arrive (interim) — AC-2's "in real time". */
  onTranscript: (text: string) => void;
  onError: (error: VoiceInputError) => void;
  /** Called once when the session is over, however it ended. */
  onEnd: () => void;
}

/**
 * One tap-to-talk session (Spec 34 §7: no always-listening). A single utterance: it ends by
 * itself when the speaker pauses, or when stopped. Null if the browser can't do it.
 */
export function startRecognition(options: StartRecognitionOptions): RecognitionSession | null {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = options.lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    options.onEnd();
  };

  recognition.onresult = (event) => {
    if (!ended) options.onTranscript(transcriptOf(event));
  };
  recognition.onerror = (event) => {
    const error = mapRecognitionError(event.error);
    if (error && !ended) options.onError(error);
  };
  recognition.onend = end;

  try {
    recognition.start();
  } catch {
    // e.g. "InvalidStateError" if the browser still thinks a session is running.
    options.onError("unavailable");
    end();
    return null;
  }

  return {
    stop: () => recognition.stop(),
    abort: () => {
      recognition.onresult = null;
      recognition.abort();
      end();
    },
  };
}
