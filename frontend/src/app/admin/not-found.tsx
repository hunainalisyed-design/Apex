import Link from "next/link";

/** Generic — not vehicle-flavored like configure/[slug]/not-found.tsx's copy — since this is
 * also what a non-admin visitor to /admin sees (Spec 21 AC-1): it must read exactly like any
 * other unknown route on this site, revealing nothing about what's actually behind it. */
export default function AdminNotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="glass-panel flex max-w-xl flex-col items-center gap-4 rounded-2xl px-10 py-14">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Apex</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Page not found.</h1>
        <Link
          href="/"
          className="focus-ring rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
