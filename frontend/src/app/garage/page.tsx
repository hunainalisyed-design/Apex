"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GarageList } from "@/components/garage/GarageList/GarageList";
import { ProfileSection } from "@/components/garage/ProfileSection/ProfileSection";
import { useAuthStore } from "@/state/authStore";

/**
 * My Garage (Spec 17) — the first Phase 2 route that's genuinely auth-gated (SRS §36.5
 * kept everything before this guest-accessible). The inverse of (auth)/layout.tsx's own
 * guard: redirects AWAY to /login?returnTo=/garage once hydrated confirms there's no
 * session (AC-1), rather than redirecting away FROM login/signup once one exists. Renders
 * nothing until hydrated, matching AuthNavControl's own "never flash the wrong state"
 * pattern.
 */
export default function GaragePage() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) router.push("/login?returnTo=/garage");
  }, [hydrated, user, router]);

  if (!hydrated || !user) return null;

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">My Garage</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Your Builds
        </h1>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <GarageList />
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <ProfileSection />
      </div>
    </main>
  );
}
