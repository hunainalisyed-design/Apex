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

// jsdom doesn't implement WebGL contexts either — HTMLCanvasElement.getContext("webgl")
// always returns null there, same as a real browser with WebGL genuinely unavailable.
// Canvas3DErrorBoundary (Spec 12) feature-detects WebGL support on mount and would treat
// every test environment as "WebGL unavailable" without this, hiding the mocked 3D scene
// components tests render in its place. Stubbed to look "available" here; tests that need
// to exercise the real unavailable path do so via a real browser in e2e instead (see
// e2e/webgl-fallback.spec.ts), where genuinely disabling WebGL is what's under test.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = ((contextId: string) => {
    if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") {
      return {} as unknown as WebGLRenderingContext;
    }
    return null;
  }) as typeof HTMLCanvasElement.prototype.getContext;
}

// jsdom doesn't implement scrolling at all — Element.prototype.scrollTo is simply absent,
// which throws for any component that auto-scrolls a container (e.g. ChatWindow's message
// list, Spec 15 AC-3). A no-op stub is sufficient since tests assert on rendered content,
// never actual scroll position.
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
