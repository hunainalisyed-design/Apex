import Link from "next/link";

/**
 * This project's first footer (Spec 24, AC-4) — nothing before this spec needed one. Kept
 * minimal on purpose: a copyright line and the one link this spec actually requires.
 */
export function Footer() {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-white/10 px-6 py-6 text-xs text-white/50 sm:flex-row sm:justify-between">
      <p>&copy; {new Date().getFullYear()} APEX. All rights reserved.</p>
      <Link href="/privacy-policy" className="underline-offset-2 hover:text-white hover:underline">
        Privacy Policy
      </Link>
    </footer>
  );
}
