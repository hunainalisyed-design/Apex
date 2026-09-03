/**
 * Static fallback shown when WebGL is unavailable (AC-5). Scoped locally to this spec for
 * now — Spec 12 (Loading/Error/A11y Shell) should generalize this into the shared
 * `<Static3DFallback>` component docs/architecture.md describes, once it exists.
 */
export function HeroFallback() {
  return (
    <div
      className="glass-panel flex h-full w-full items-center justify-center rounded-2xl"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, rgba(61,111,224,0.25), rgba(10,10,12,0.4) 70%)",
      }}
    >
      <span className="text-sm text-white/50">3D preview unavailable</span>
    </div>
  );
}
