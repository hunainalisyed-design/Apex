"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";
import type { VehicleSummaryDto } from "@/types/catalog";

export interface StatsSectionProps {
  vehicle: VehicleSummaryDto;
}

interface Stat {
  value: string;
  unit: string;
  label: string;
}

/**
 * Cinematic stats band — real numbers from the same featured VehicleSummaryDto Hero already
 * received (page.tsx), not fabricated placeholders. km/h and raw seconds match the unit
 * convention Static3DFallback.tsx already displays for these same fields.
 */
export function StatsSection({ vehicle }: StatsSectionProps) {
  const reducedMotion = useReducedMotion();

  const stats: Stat[] = [
    { value: vehicle.zeroToHundredSec.toFixed(1), unit: "s", label: "0–100 km/h" },
    { value: String(vehicle.horsepower), unit: "", label: "Horsepower" },
    { value: String(vehicle.topSpeedKph), unit: "km/h", label: "Top Speed" },
  ];

  return (
    <section
      aria-label={`${vehicle.name} performance`}
      className="relative overflow-hidden px-6 py-24 lg:px-16"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(61,111,224,0.14), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 30%)",
        }}
      />

      <motion.div
        className="relative mx-auto flex max-w-4xl flex-col items-center gap-4 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: withReducedMotion(reducedMotion, 0.6, 0) }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">More Than a Car</p>
        <h2
          className="text-3xl font-bold tracking-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          A DRIVER-FOCUSED EXPERIENCE.
        </h2>
        <p className="max-w-xl text-balance text-white/60">
          Every element of the {vehicle.name} is designed for control, comfort, and connection.
        </p>
      </motion.div>

      <motion.div
        className="relative mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-10 sm:grid-cols-3"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: withReducedMotion(reducedMotion, 0.6, 0), delay: withReducedMotion(reducedMotion, 0.15, 0) }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
            <p
              className="text-4xl font-bold tracking-tight sm:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {stat.value}
              {stat.unit && <span className="ml-1 text-2xl text-white/50 sm:text-3xl">{stat.unit}</span>}
            </p>
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">{stat.label}</p>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
