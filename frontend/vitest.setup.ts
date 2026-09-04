import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia. Every component using useReducedMotion needs this,
// so it's stubbed globally here rather than per-test. Defaults to "no preference"; tests
// that need reduced-motion=true still mock useReducedMotion directly (see Hero.test.tsx).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
