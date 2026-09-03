"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { useHeroSequence } from "./useHeroSequence";
import { isStageAtLeast } from "./heroSequence";
import { HeroErrorBoundary } from "./HeroErrorBoundary";
import { HeroFallback } from "./HeroFallback";

const HeroScene = dynamic(() => import("./HeroScene").then((m) => m.HeroScene), {
  ssr: false,
  loading: () => <HeroFallback />,
});

export interface HeroProps {
  vehicle: {
    name: string;
    tagline: string;
  };
}

const SHOWROOM_HREF = "/showroom";

export function Hero({ vehicle }: HeroProps) {
  const stage = useHeroSequence();
  const headlineVisible = isStageAtLeast(stage, "headline");
  const ctaVisible = isStageAtLeast(stage, "cta");

  return (
    <main
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
        transition={{ duration: 0.8 }}
      />

      <div
        aria-hidden="true"
        className="relative h-[280px] w-full max-w-2xl sm:h-[380px]"
      >
        <HeroErrorBoundary>
          <HeroScene stage={stage} />
        </HeroErrorBoundary>
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
          transition={{ duration: 0.6 }}
        >
          BUILD YOUR VISION.
        </motion.h1>

        <motion.p
          className="max-w-md text-balance text-white/70"
          initial={{ opacity: 0, y: 12 }}
          animate={headlineVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Configure every detail of your vehicle in an immersive 3D experience.
        </motion.p>

        <motion.div
          className="flex flex-col gap-3 sm:flex-row"
          initial={{ opacity: 0, y: 12 }}
          animate={ctaVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            href={SHOWROOM_HREF}
            className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Configure Your Car
          </Link>
          <Link
            href={SHOWROOM_HREF}
            className="glass-panel rounded-full px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore Models
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
