"use client";

import { useAuthStore } from "@/state/authStore";
import AdminNotFound from "./not-found";

/**
 * Gates every /admin/* route (Spec 21 AC-1) — deliberately a real 404, not a redirect to
 * /login like (auth)/layout.tsx's guard or garage/page.tsx's own guard: AC-1 wants a
 * non-admin (including signed-out) visitor to see exactly what they'd see for a route that
 * doesn't exist, not a page that confirms /admin exists but requires elevated access.
 *
 * Renders the not-found UI directly rather than calling next/navigation's notFound() —
 * verified (via a failing e2e run) that Next's not-found.tsx convention does NOT catch a
 * notFound() thrown from a segment's own layout.tsx (a Client Component here): it bubbles
 * past app/admin/not-found.tsx to the root's generic "This page could not be found" 404
 * instead. Rendering the same component directly sidesteps that routing nuance entirely and
 * is equally valid — this guard is UX only regardless of mechanism, since this app has no
 * server-side auth signal (authStore's own doc comment); the real security boundary is the
 * backend's requireAdmin middleware, which returns the same generic 404 for every non-admin
 * API call no matter what this client-side guard does. not-found.tsx itself is kept as-is so
 * Next's own routing still shows it for a genuinely unmatched /admin/* sub-path.
 *
 * Split out from layout.tsx (Spec 23) so that file can be a Server Component exporting
 * `noindex` metadata — a Client Component can't export `metadata` itself.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return null;
  if (!user || user.role !== "ADMIN") return <AdminNotFound />;

  return <>{children}</>;
}
