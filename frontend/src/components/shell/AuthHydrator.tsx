"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/state/authStore";

/**
 * Fires the single GET /api/auth/me call (Spec 16, AC-10) that hydrates authStore on every
 * page load. Rendered once in the root layout, alongside Nav — its only job is triggering
 * refreshMe(); nothing else in the app calls it, so this is the one place that fetch fires.
 */
export function AuthHydrator() {
  useEffect(() => {
    useAuthStore.getState().refreshMe();
  }, []);

  return null;
}
