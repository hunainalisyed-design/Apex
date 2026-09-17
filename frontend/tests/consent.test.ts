import { beforeEach, describe, expect, it } from "vitest";
import { hasAnalyticsConsent, useConsentStore } from "../src/state/consentStore";

describe("consentStore (Spec 24, AC-1/AC-2/AC-3)", () => {
  beforeEach(() => {
    localStorage.clear();
    useConsentStore.setState({ hydrated: false, choice: null });
  });

  it("starts with no choice and not hydrated, so the banner never flashes before localStorage is read", () => {
    const state = useConsentStore.getState();
    expect(state.hydrated).toBe(false);
    expect(state.choice).toBeNull();
  });

  it("hydrate() reads no stored choice as null on a genuinely first visit", () => {
    useConsentStore.getState().hydrate();
    expect(useConsentStore.getState()).toMatchObject({ hydrated: true, choice: null });
  });

  it("accept() persists to localStorage and hasAnalyticsConsent() then returns true (AC-1)", () => {
    useConsentStore.getState().accept();

    expect(useConsentStore.getState().choice).toBe("accepted");
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("reject() persists rejection and hasAnalyticsConsent() stays false (AC-3)", () => {
    useConsentStore.getState().reject();

    expect(useConsentStore.getState().choice).toBe("rejected");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("a stored choice survives a fresh hydrate() call, e.g. a page reload (AC-2)", () => {
    useConsentStore.getState().accept();
    useConsentStore.setState({ hydrated: false, choice: null }); // simulate a fresh page load

    useConsentStore.getState().hydrate();

    expect(useConsentStore.getState().choice).toBe("accepted");
  });

  it("before any consent choice is made, analytics is never considered consented to (AC-3)", () => {
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("a choice stored under an old policy version is treated as no choice (AC-2)", () => {
    localStorage.setItem("apex_cookie_consent", JSON.stringify({ choice: "accepted", policyVersion: 0 }));

    useConsentStore.getState().hydrate();

    expect(useConsentStore.getState().choice).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });
});
