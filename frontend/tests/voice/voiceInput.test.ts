import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSpeechRecognitionSupported,
  mapRecognitionError,
  startRecognition,
  transcriptOf,
} from "../../src/lib/voice/speechRecognition";
import { cancelSpeech, getSpeakingId, isSpeechSynthesisSupported, speak } from "../../src/lib/voice/speechSynthesis";
import {
  getSpeakRepliesSnapshot,
  hasSeenVoiceNote,
  markVoiceNoteSeen,
  resetVoicePreferencesForTests,
  setSpeakReplies,
  SPEAK_REPLIES_KEY,
} from "../../src/lib/voice/voicePreferences";
import { FakeRecognition, installFakeRecognition, installFakeSynthesis } from "./fakeSpeech";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  resetVoicePreferencesForTests();
});

describe("speech recognition (Spec 34)", () => {
  it("is supported only when the browser has it — standard or webkit-prefixed (AC-1)", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
    installFakeRecognition("webkitSpeechRecognition");
    expect(isSpeechRecognitionSupported()).toBe(true);
    vi.unstubAllGlobals();
    installFakeRecognition("SpeechRecognition");
    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it("maps browser errors to what the user is told (AC-5)", () => {
    expect(mapRecognitionError("not-allowed")).toBe("denied");
    expect(mapRecognitionError("service-not-allowed")).toBe("denied");
    expect(mapRecognitionError("audio-capture")).toBe("noMicrophone");
    expect(mapRecognitionError("no-speech")).toBe("noSpeech");
    expect(mapRecognitionError("network")).toBe("unavailable");
    expect(mapRecognitionError("something-new")).toBe("unavailable");
    expect(mapRecognitionError("aborted")).toBeNull(); // we stopped it on purpose
  });

  it("joins every result heard so far into one transcript", () => {
    const results = [Object.assign([{ transcript: "make it " }], { isFinal: true }), Object.assign([{ transcript: "sportier" }], { isFinal: false })];
    expect(transcriptOf({ resultIndex: 1, results })).toBe("make it sportier");
  });

  it("listens once, in the app's language, streaming words as they're heard (AC-2)", () => {
    installFakeRecognition();
    const onTranscript = vi.fn();
    const onEnd = vi.fn();
    const session = startRecognition({ lang: "en-US", onTranscript, onError: vi.fn(), onEnd });
    const recognition = FakeRecognition.latest();
    expect(session).not.toBeNull();
    expect(recognition).toMatchObject({ lang: "en-US", interimResults: true, continuous: false, started: true });

    recognition.hear(["make it"]);
    recognition.hear(["make it ", "more aggressive"], true);
    expect(onTranscript.mock.calls.map((c) => c[0])).toEqual(["make it", "make it more aggressive"]);
    recognition.finish();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("reports a failure once and ends; stopping on purpose is not a failure", () => {
    installFakeRecognition();
    const onError = vi.fn();
    const onEnd = vi.fn();
    startRecognition({ lang: "en-US", onTranscript: vi.fn(), onError, onEnd });
    FakeRecognition.latest().fail("not-allowed");
    expect(onError).toHaveBeenCalledWith("denied");
    expect(onEnd).toHaveBeenCalledOnce();

    const onError2 = vi.fn();
    const session = startRecognition({ lang: "en-US", onTranscript: vi.fn(), onError: onError2, onEnd: vi.fn() })!;
    session.abort();
    FakeRecognition.latest().onerror?.({ error: "aborted" });
    expect(onError2).not.toHaveBeenCalled();
  });

  it("abort discards words still on the way", () => {
    installFakeRecognition();
    const onTranscript = vi.fn();
    const session = startRecognition({ lang: "en-US", onTranscript, onError: vi.fn(), onEnd: vi.fn() })!;
    const recognition = FakeRecognition.latest();
    session.abort();
    recognition.hear(["late words"]);
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("returns null in a browser without it, or if the browser refuses to start", () => {
    expect(startRecognition({ lang: "en-US", onTranscript: vi.fn(), onError: vi.fn(), onEnd: vi.fn() })).toBeNull();
    installFakeRecognition();
    const onError = vi.fn();
    const onEnd = vi.fn();
    const Throwing = class extends FakeRecognition {
      start = vi.fn(() => {
        throw new Error("InvalidStateError");
      });
    };
    vi.stubGlobal("webkitSpeechRecognition", Throwing);
    expect(startRecognition({ lang: "en-US", onTranscript: vi.fn(), onError, onEnd })).toBeNull();
    expect(onError).toHaveBeenCalledWith("unavailable");
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe("speech synthesis (Spec 34, AC-3)", () => {
  it("does nothing where unsupported", () => {
    expect(isSpeechSynthesisSupported()).toBe(false);
    speak("m1", "hello", "en-US");
    expect(getSpeakingId()).toBeNull();
  });

  it("speaks one reply at a time and tracks which one", () => {
    const { synth, spoken } = installFakeSynthesis();
    speak("m1", "First reply", "en-US");
    expect(getSpeakingId()).toBe("m1");
    expect(spoken[0]).toMatchObject({ text: "First reply", lang: "en-US" });

    speak("m2", "Second reply", "en-US");
    expect(synth.cancel).toHaveBeenCalled(); // the first was cut off
    expect(getSpeakingId()).toBe("m2");
    spoken[0].onend?.(); // a stale end event doesn't clear the new one
    expect(getSpeakingId()).toBe("m2");
    spoken[1].onend?.();
    expect(getSpeakingId()).toBeNull();
  });

  it("stops mid-sentence", () => {
    const { synth } = installFakeSynthesis();
    speak("m1", "A long reply", "en-US");
    cancelSpeech();
    expect(synth.cancel).toHaveBeenCalled();
    expect(getSpeakingId()).toBeNull();
  });
});

describe("voice preferences (Spec 34, AC-4)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetVoicePreferencesForTests();
  });

  it("speak replies is off by default, and remembered once turned on", () => {
    expect(getSpeakRepliesSnapshot()).toBe(false);
    setSpeakReplies(true);
    expect(localStorage.getItem(SPEAK_REPLIES_KEY)).toBe("true");
    resetVoicePreferencesForTests();
    expect(getSpeakRepliesSnapshot()).toBe(true);
    setSpeakReplies(false);
    expect(getSpeakRepliesSnapshot()).toBe(false);
  });

  it("still works for this page when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setSpeakReplies(true);
    expect(getSpeakRepliesSnapshot()).toBe(true);
    vi.restoreAllMocks();
  });

  it("remembers that the privacy note was seen", () => {
    expect(hasSeenVoiceNote()).toBe(false);
    markVoiceNoteSeen();
    expect(hasSeenVoiceNote()).toBe(true);
  });
});
