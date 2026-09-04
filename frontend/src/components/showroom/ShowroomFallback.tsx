/**
 * Static fallback for GLB/WebGL failure (AC per spec §5) — local stand-in for Spec 12's
 * shared 3D error fallback, same pattern as Spec 04's HeroFallback.
 */
export function ShowroomFallback() {
  return (
    <div
      className="glass-panel flex h-full w-full items-center justify-center rounded-2xl"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, rgba(61,111,224,0.2), rgba(10,10,12,0.4) 70%)",
      }}
    >
      <span className="text-sm text-white/50">3D preview unavailable</span>
    </div>
  );
}
