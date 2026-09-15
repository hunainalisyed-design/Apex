"use client";

import Link from "next/link";
import { useAuthStore } from "@/state/authStore";

const LINK_CLASS =
  "focus-ring rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white";

/**
 * The nav's account area (Spec 16, AC-10) — Log In / Sign Up links when signed out, the
 * user's name plus a Log Out control when signed in. Renders nothing until `hydrated` is
 * true, so a page load never flashes "signed out" controls a moment before flashing
 * "signed in" ones (or vice versa) — same accepted brief-flash trade-off documented on
 * authStore itself, just resolved to "render nothing" rather than "render the wrong state."
 * `/garage` is Spec 17's future My Garage route — reserved here the same way Spec 13
 * reserved Compare's nav slot ahead of its own spec.
 */
export function AuthNavControl() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const logout = useAuthStore((s) => s.logout);

  if (!hydrated) return null;

  if (user) {
    return (
      <div className="flex items-center gap-1">
        {user.role === "ADMIN" && (
          <Link href="/admin" className={LINK_CLASS}>
            Admin
          </Link>
        )}
        <Link href="/garage" className={LINK_CLASS}>
          {user.name}
        </Link>
        <button type="button" onClick={() => logout()} className={LINK_CLASS}>
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link href="/login" className={LINK_CLASS}>
        Log In
      </Link>
      <Link href="/signup" className={LINK_CLASS}>
        Sign Up
      </Link>
    </div>
  );
}
