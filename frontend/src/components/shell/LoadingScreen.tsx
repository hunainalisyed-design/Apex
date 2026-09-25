import { useTranslations } from "next-intl";

export interface LoadingScreenProps {
  label?: string;
}

/**
 * Determinate-styled loading state (Spec 12, AC-2) — not a spinner. Relocated/renamed from
 * Spec 5's ShowroomLoadingScreen, now generic via a `label` prop (defaulting to the
 * original copy so existing behavior is unchanged).
 *
 * Currently decorative (a fixed-duration CSS animation), not driven by real download
 * bytes: this branch's 3D rig is fully procedural, with no real GLB fetch to track
 * progress against — a known, stated limitation (see docs/CLAUDE.md's "Known open
 * blocker"), not a fabricated signal. Revisit once a real asset pipeline exists.
 */
export function LoadingScreen({ label }: LoadingScreenProps) {
  const t = useTranslations("shell");
  return (
    <div className="glass-panel flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-white/60">{label ?? t("loadingShowroom")}</p>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-full origin-left animate-[showroom-progress_0.6s_ease-out_forwards] bg-white" />
      </div>
    </div>
  );
}
