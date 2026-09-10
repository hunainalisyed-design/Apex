"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSafeReturnTo } from "@/lib/auth/validation";
import { useAuthStore } from "@/state/authStore";

/**
 * Owns the "already signed in" redirect guard — client-side only, since (per authStore's
 * own doc comment) this app has no server-side auth signal to redirect on. Runs after
 * `hydrated` flips true specifically so a page refresh while signed in doesn't flash the
 * form before bouncing away. Honors a `?returnTo=` query param (Spec 17, AC-1's "sends
 * them back to /garage after signing in"), validated against an open-redirect via
 * isSafeReturnTo before ever being used.
 *
 * Split into its own component because useSearchParams() must be called in a descendant
 * of the <Suspense> boundary below, not the component that renders that boundary.
 */
function AuthRedirectGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();
  const returnTo = useSearchParams().get("returnTo");

  useEffect(() => {
    if (hydrated && user) router.push(isSafeReturnTo(returnTo) ? returnTo : "/");
  }, [hydrated, user, router, returnTo]);

  return children;
}

/**
 * Shared chrome for the four auth pages (Spec 16, AC-11): a single centered glass-panel
 * card so login/signup/forgot-password/reset-password read as one consistent flow rather
 * than four separately-styled pages. The Suspense fallback is `null` — the same brief-flash
 * trade-off already accepted on authStore itself, not worth a dedicated skeleton for a
 * sub-100ms boundary.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-full flex-1 items-center justify-center px-6 py-16"
    >
      <div className="glass-panel w-full max-w-sm rounded-2xl p-8">
        <Suspense fallback={null}>
          <AuthRedirectGuard>{children}</AuthRedirectGuard>
        </Suspense>
      </div>
    </main>
  );
}
