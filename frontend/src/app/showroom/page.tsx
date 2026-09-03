/**
 * Placeholder target for the landing page's "Configure Your Car" / "Explore Models" CTAs
 * (Spec 4). This route is properly owned and built out by Spec 5 (3D Showroom Core) — this
 * stub exists only so navigation from the landing page is real and testable in the meantime.
 */
export default function ShowroomPlaceholder() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="glass-panel flex max-w-xl flex-col items-center gap-4 rounded-2xl px-10 py-14">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Apex Showroom</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          The 3D showroom is coming soon.
        </h1>
        <p className="max-w-md text-balance text-white/70">
          Vehicle selection and full configuration land with Spec 5.
        </p>
      </div>
    </main>
  );
}
