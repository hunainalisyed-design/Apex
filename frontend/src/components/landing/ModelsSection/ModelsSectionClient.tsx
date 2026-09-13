"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";
import type { VehicleSummaryDto } from "@/types/catalog";
import { ModelCard } from "./ModelCard";
import { StartBuildingPanel } from "./StartBuildingPanel";

export interface ModelsSectionClientProps {
  vehicles: VehicleSummaryDto[];
  configureHref: string;
}

export function ModelsSectionClient({ vehicles, configureHref }: ModelsSectionClientProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: withReducedMotion(reducedMotion, 0.6, 0) }}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-2">
        {vehicles.map((vehicle) => (
          <ModelCard key={vehicle.slug} vehicle={vehicle} />
        ))}
      </div>
      <div className="lg:col-span-1">
        <StartBuildingPanel configureHref={configureHref} />
      </div>
    </motion.div>
  );
}
