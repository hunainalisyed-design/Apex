"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { useHeroSequence } from "./useHeroSequence";
import { isStageAtLeast } from "./heroSequence";
import { Canvas3DErrorBoundary } from "@/components/shell/Canvas3DErrorBoundary";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";
import type { VehicleSummaryDto } from "@/types/catalog";

const HeroScene = dynamic(() => import("./HeroScene").then((m) => m.HeroScene), {
  ssr: false,
  loading: () => <LoadingScreen label="Loading…" />,
});

export interface HeroProps {
  vehicle: VehicleSummaryDto;
}

const MODELS_HREF = "/models";

export function Hero({ vehicle }: HeroProps) {
  const stage = useHeroSequence();
  const headlineVisible = isStageAtLeast(stage, "headline");
  const ctaVisible = isStageAtLeast(stage, "cta");
  const reducedMotion = useReducedMotion();
  // The 3D scene is purely decorative and correctly hidden from assistive tech — but its
  // fallback (Spec 12 AC-1) is real, substantive content (vehicle name + spec sheet) that
  // must NOT inherit that aria-hidden, or a screen-reader user with no WebGL support gets
  // nothing from this area at all, same failure as an unstyled broken canvas.
  const [sceneError, setSceneError] = useState(false);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-full flex-1 flex-col items-center justify-center gap-10 overflow-hidden px-6 py-16 lg:flex-row lg:gap-16 lg:px-16"
      data-hero-stage={stage}
    >
      {/* Kept as the literal first child of <main> — e2e/landing.spec.ts's drag-to-rotate
          test locates it via `main [aria-hidden='true']` .first(), independent of the
          lg:order-* visual reordering below (DOM order, not visual order, is what .first()
          resolves against). */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 72% 38%, rgba(61,111,224,0.22), transparent 55%), radial-gradient(circle at 8% 85%, rgba(120,80,255,0.1), transparent 50%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: withReducedMotion(reducedMotion, 0.8, 0) }}
      />

      <div className="glass-panel relative z-10 order-2 -mt-10 flex w-full max-w-2xl flex-col items-start gap-6 rounded-2xl px-8 py-10 text-left sm:-mt-16 sm:px-10 lg:order-1 lg:mt-0 lg:w-[38%] lg:flex-shrink-0 lg:px-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">
          {vehicle.name} — {vehicle.tagline}
        </p>

        <motion.h1
          className="text-4xl font-bold tracking-tight sm:text-6xl"
          style={{ fontFamily: "var(--font-display)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={headlineVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: withReducedMotion(reducedMotion, 0.6, 0) }}
        >
          BUILD YOUR VISION.
        </motion.h1>

        <motion.p
          className="max-w-md text-balance text-white/70"
          initial={{ opacity: 0, y: 12 }}
          animate={headlineVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: withReducedMotion(reducedMotion, 0.6, 0), delay: withReducedMotion(reducedMotion, 0.1, 0) }}
        >
          Configure every detail of your vehicle in an immersive 3D experience.
        </motion.p>

        <motion.div
          className="flex flex-col gap-3 sm:flex-row"
          initial={{ opacity: 0, y: 12 }}
          animate={ctaVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: withReducedMotion(reducedMotion, 0.5, 0) }}
        >
          <Link
            href={`/configure/${vehicle.slug}`}
            className="focus-ring group flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black shadow-[0_0_32px_-10px_rgba(255,255,255,0.6)] transition hover:bg-white/90 hover:shadow-[0_0_40px_-6px_rgba(255,255,255,0.8)]"
          >
            Configure Your Car
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <Link
            href={MODELS_HREF}
            className="glass-panel focus-ring rounded-full px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Explore Models
          </Link>
        </motion.div>
      </div>

      <div
        aria-hidden={!sceneError}
        className="relative order-1 h-[380px] w-full max-w-2xl sm:h-[460px] lg:order-2 lg:h-[640px] lg:max-w-none lg:flex-1"
      >
        <Canvas3DErrorBoundary vehicle={vehicle} onError={() => setSceneError(true)}>
          <HeroScene stage={stage} />
        </Canvas3DErrorBoundary>

        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-6 right-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/45"
          initial={{ opacity: 0 }}
          animate={ctaVisible ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: withReducedMotion(reducedMotion, 0.6, 0) }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20">⟲</span>
          Drag to rotate
        </motion.div>
      </div>
    </main>
  );
}
