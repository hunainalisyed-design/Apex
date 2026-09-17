import { create } from "zustand";
import * as authApi from "@/lib/api/auth";
import { ApiRequestError } from "@/lib/api/configurations";
import * as meApi from "@/lib/api/me";
import type { UserDto } from "@/types/auth";

export interface AuthState {
  user: UserDto | null;
  /** Distinguishes "haven't checked yet" from "checked, definitely signed out" — both the
   * (auth) route group's redirect guard and the nav's account display read this alongside
   * `user` so they can never disagree (Spec 16). */
  hydrated: boolean;
  isLoading: boolean;
  /** Field-specific errors from the last failed action (Spec 16) — e.g. { email: [...] }
   * for EMAIL_ALREADY_REGISTERED. A form shows these inline per field; getErrorMessage(code)
   * is the form-level banner fallback for anything without field-specific details. */
  details: Record<string, string[]> | null;
  errorCode: string | null;
  signup: (input: { name: string; email: string; password: string; acceptedTerms: true }) => Promise<boolean>;
  login: (input: { email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Spec 24, AC-6 — after a successful account deletion, the backend has already cleared
   * the session cookie itself; calling the real logout() here would just make a doomed
   * second request to an endpoint the now-deleted account can't authenticate against. This
   * is a plain synchronous state clear, no API call. */
  clearSession: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  /** Calls GET /api/auth/me once (AC-10) — invoked by AuthHydrator on mount. */
  refreshMe: () => Promise<void>;
  clearError: () => void;
  /** Profile editing (Spec 17, AC-9) — lives here, not garageStore, since it's an identity
   * concern like the rest of this store. Success updates `user` in place so Nav's
   * displayed name stays in sync immediately. */
  updateProfile: (name: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

/**
 * Auth state (Spec 16) — a plain global Zustand store, matching configurationStore.ts and
 * carAiChatStore.ts's own convention rather than React Context, so it survives Next.js
 * client-side navigation. No server-side cookie read exists anywhere in this app (no
 * precedent for next/headers' cookies()); this store's `hydrated` flag exists specifically
 * to make that trade-off safe, the same SSR-safe-default-then-correct-after-hydration
 * pattern useIsDesktopViewport/useReducedMotion already use elsewhere in this codebase.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  isLoading: false,
  details: null,
  errorCode: null,

  signup: async (input) => {
    set({ isLoading: true, details: null, errorCode: null });
    try {
      const user = await authApi.signup(input);
      set({ user, hydrated: true, isLoading: false });
      return true;
    } catch (err) {
      const details = err instanceof ApiRequestError ? (err.details ?? null) : null;
      const errorCode = err instanceof ApiRequestError ? err.code : null;
      set({ isLoading: false, details, errorCode });
      return false;
    }
  },

  login: async (input) => {
    set({ isLoading: true, details: null, errorCode: null });
    try {
      const user = await authApi.login(input);
      set({ user, hydrated: true, isLoading: false });
      return true;
    } catch (err) {
      const details = err instanceof ApiRequestError ? (err.details ?? null) : null;
      const errorCode = err instanceof ApiRequestError ? err.code : null;
      set({ isLoading: false, details, errorCode });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authApi.logout();
    } finally {
      set({ user: null, hydrated: true, isLoading: false });
    }
  },

  clearSession: () => set({ user: null, hydrated: true }),

  forgotPassword: async (email) => {
    set({ isLoading: true, details: null, errorCode: null });
    try {
      await authApi.forgotPassword({ email });
      set({ isLoading: false });
      return true;
    } catch (err) {
      const details = err instanceof ApiRequestError ? (err.details ?? null) : null;
      const errorCode = err instanceof ApiRequestError ? err.code : null;
      set({ isLoading: false, details, errorCode });
      return false;
    }
  },

  resetPassword: async (token, newPassword) => {
    set({ isLoading: true, details: null, errorCode: null });
    try {
      await authApi.resetPassword({ token, newPassword });
      set({ isLoading: false });
      return true;
    } catch (err) {
      const details = err instanceof ApiRequestError ? (err.details ?? null) : null;
      const errorCode = err instanceof ApiRequestError ? err.code : null;
      set({ isLoading: false, details, errorCode });
      return false;
    }
  },

  refreshMe: async () => {
    try {
      const user = await authApi.getMe();
      set({ user, hydrated: true });
    } catch {
      set({ user: null, hydrated: true });
    }
  },

  clearError: () => set({ details: null, errorCode: null }),

  updateProfile: async (name) => {
    set({ isLoading: true, details: null, errorCode: null });
    try {
      const user = await meApi.updateProfile({ name });
      set({ user, isLoading: false });
      return true;
    } catch (err) {
      const details = err instanceof ApiRequestError ? (err.details ?? null) : null;
      const errorCode = err instanceof ApiRequestError ? err.code : null;
      set({ isLoading: false, details, errorCode });
      return false;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isLoading: true, details: null, errorCode: null });
    try {
      await meApi.changePassword({ currentPassword, newPassword });
      set({ isLoading: false });
      return true;
    } catch (err) {
      const details = err instanceof ApiRequestError ? (err.details ?? null) : null;
      const errorCode = err instanceof ApiRequestError ? err.code : null;
      set({ isLoading: false, details, errorCode });
      return false;
    }
  },
}));
