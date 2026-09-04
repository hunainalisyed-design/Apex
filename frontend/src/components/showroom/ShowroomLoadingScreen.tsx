/**
 * "INITIALIZING SHOWROOM..." loading state (Spec 12's contract, stood in locally here the
 * same way Spec 04's HeroFallback was until Spec 12 exists). The placeholder rig has no
 * real network download, so the progress bar is structurally a determinate bar (not a
 * spinner) but doesn't track real bytes yet — revisit once a real GLB is wired in.
 */
export function ShowroomLoadingScreen() {
  return (
    <div className="glass-panel flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-white/60">Initializing Showroom…</p>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-full origin-left animate-[showroom-progress_0.6s_ease-out_forwards] bg-white" />
      </div>
    </div>
  );
}
