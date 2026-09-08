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
      className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16"
      data-hero-stage={stage}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(61,111,224,0.18), transparent 60%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: withReducedMotion(reducedMotion, 0.8, 0) }}
      />

      <div
        aria-hidden={!sceneError}
        className="relative h-[280px] w-full max-w-2xl sm:h-[380px]"
      >
        <Canvas3DErrorBoundary vehicle={vehicle} onError={() => setSceneError(true)}>
          <HeroScene stage={stage} />
        </Canvas3DErrorBoundary>
      </div>

      <div className="glass-panel relative z-10 -mt-10 flex max-w-2xl flex-col items-center gap-6 rounded-2xl px-10 py-10 text-center sm:-mt-16">
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
            className="focus-ring rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Configure Your Car
          </Link>
          <Link
            href={MODELS_HREF}
            className="glass-panel focus-ring rounded-full px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Explore Models
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
