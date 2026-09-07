import Link from "next/link";

export interface BuildNotFoundPanelProps {
  slug: string;
}

/** Spec 10's dedicated "This build could not be found" state (its UI-states row, AC-3) —
 * distinct from the vehicle-specific not-found.tsx boundary, since a bad/expired ?build=
 * id is a different failure than an unknown vehicle slug. */
export function BuildNotFoundPanel({ slug }: BuildNotFoundPanelProps) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="glass-panel flex max-w-xl flex-col items-center gap-4 rounded-2xl px-10 py-14">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Apex Showroom</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">This build could not be found.</h1>
        <p className="text-sm text-white/60">
          The saved configuration you followed a link to no longer exists or was mistyped.
        </p>
        <Link
          href={`/configure/${slug}`}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Start a New Configuration
        </Link>
      </div>
    </main>
  );
}
