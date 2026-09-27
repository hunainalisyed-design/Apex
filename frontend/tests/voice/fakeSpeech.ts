import { vi } from "vitest";

/** A stand-in for the browser's SpeechRecognition that the test drives by hand. */
export class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  start = vi.fn(() => {
    this.started = true;
  });
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());

  constructor() {
    FakeRecognition.instances.push(this);
  }

  /** Emits the words heard so far, as the browser does (interim until `final`). */
  hear(words: string[], final = false) {
    const results = words.map((transcript, i) => Object.assign([{ transcript }], { isFinal: final || i < words.length - 1 }));
    this.onresult?.({ resultIndex: 0, results });
  }

  fail(error: string) {
    this.onerror?.({ error });
    this.onend?.();
  }

  finish() {
    this.onend?.();
  }

  static latest(): FakeRecognition {
    return FakeRecognition.instances[FakeRecognition.instances.length - 1];
  }
}

export class FakeUtterance {
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  lang = "";
  constructor(public text: string) {}
}

/** A stand-in for window.speechSynthesis that records what was spoken. */
export function installFakeSynthesis() {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
    cancel: vi.fn(),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return { synth, spoken };
}

export function installFakeRecognition(name: "SpeechRecognition" | "webkitSpeechRecognition" = "webkitSpeechRecognition") {
  FakeRecognition.instances = [];
  vi.stubGlobal(name, FakeRecognition);
}
