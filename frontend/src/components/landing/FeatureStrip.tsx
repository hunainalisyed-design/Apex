"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

// Minimal hand-rolled line icons (stroke="currentColor", ~24px viewBox) — the codebase has
// no icon library installed anywhere and this redesign needs only a handful of icons total,
// well under where adding one would pay for itself.
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FEATURES: Feature[] = [
  {
    title: "3D Configuration",
    description: "Real-time visualization",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
        <path d="M4 7l8 4 8-4M12 11v10" />
      </svg>
    ),
  },
  {
    title: "Premium Materials",
    description: "Authentic finishes",
    icon: (
      <svg {...iconProps}>
        <path d="M4 8 12 4l8 4-8 4-8-4Z" />
        <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
      </svg>
    ),
  },
  {
    title: "Performance Data",
    description: "Live specifications",
    icon: (
      <svg {...iconProps}>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M12 12 16 8M8 13a4 4 0 0 1 8 0" />
      </svg>
    ),
  },
  {
    title: "Immersive Experience",
    description: "See it before you drive it",
    icon: (
      <svg {...iconProps}>
        <rect x="2.5" y="7" width="19" height="11" rx="3" />
        <circle cx="8.5" cy="12.5" r="1.75" />
        <circle cx="15.5" cy="12.5" r="1.75" />
      </svg>
    ),
  },
];

export function FeatureStrip() {
  const reducedMotion = useReducedMotion();

  return (
    <section aria-label="Why APEX" className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-16">
      <ul className="glass-panel grid grid-cols-1 gap-8 rounded-2xl px-8 py-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
        {FEATURES.map((feature, i) => (
          <motion.li
            key={feature.title}
            className="flex items-start gap-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: withReducedMotion(reducedMotion, 0.5, 0),
              delay: withReducedMotion(reducedMotion, i * 0.08, 0),
            }}
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/15 text-white/80"
            >
              {feature.icon}
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">{feature.title}</p>
              <p className="text-sm text-white/55">{feature.description}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
