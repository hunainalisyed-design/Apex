"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export interface StartBuildingPanelProps {
  configureHref: string;
}

const STEPS = ["Choose your model", "Customize every detail", "See it in 3D", "Get your specification"];

/** Deliberately distinct CTA copy from Hero's own "Configure Your Car" — that exact string
 * is asserted verbatim by e2e/landing.spec.ts's `.first()`-scoped locator; a second
 * identically-labeled link elsewhere on the page would make that locator ambiguous. */
export function StartBuildingPanel({ configureHref }: StartBuildingPanelProps) {
  return (
    <motion.div
      className="glass-panel flex h-full flex-col justify-between gap-8 rounded-2xl p-8"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col gap-6">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">Start Building</p>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-4 text-sm text-white/80">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-semibold text-white/60"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <Link
        href={configureHref}
        className="focus-ring flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
      >
        Start Building
        <span aria-hidden="true">→</span>
      </Link>
    </motion.div>
  );
}
