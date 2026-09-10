"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/state/authStore";

/**
 * Shared chrome for the four auth pages (Spec 16, AC-11): a single centered glass-panel
 * card so login/signup/forgot-password/reset-password read as one consistent flow rather
 * than four separately-styled pages. Also owns the "already signed in" redirect guard —
 * client-side only, since (per authStore's own doc comment) this app has no server-side
 * auth signal to redirect on. Runs after `hydrated` flips true specifically so a page
 * refresh while signed in doesn't flash the form before bouncing away.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && user) router.push("/");
  }, [hydrated, user, router]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-full flex-1 items-center justify-center px-6 py-16"
    >
      <div className="glass-panel w-full max-w-sm rounded-2xl p-8">{children}</div>
    </main>
  );
}
