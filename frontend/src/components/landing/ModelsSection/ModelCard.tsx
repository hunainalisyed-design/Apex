"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatPriceCents } from "@/lib/format/currency";
import type { VehicleSummaryDto } from "@/types/catalog";

export interface ModelCardProps {
  vehicle: VehicleSummaryDto;
}

/** One catalog vehicle's card in the homepage "Our Models" grid. Real photo when
 * `thumbnailUrl` resolves (falls back to the same neutral gradient+name placeholder
 * `/models/page.tsx` already uses for vehicles with none yet, e.g. the Porsche until a real
 * photo is supplied) — a plain <img> with an onError fallback, not next/image, matching
 * this codebase's established convention (Static3DFallback.tsx's own documented reasoning:
 * a broken/missing file shouldn't hard-fail the page). */
export function ModelCard({ vehicle }: ModelCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(vehicle.thumbnailUrl) && !imageFailed;

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.25 }}>
      <Link
        href={`/configure/${vehicle.slug}`}
        className="focus-ring glass-panel group flex h-full flex-col overflow-hidden rounded-2xl transition hover:border-white/20"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vehicle.thumbnailUrl}
              alt=""
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center"
              style={{
                background: "radial-gradient(circle at 50% 40%, rgba(61,111,224,0.25), rgba(10,10,12,0.5) 70%)",
              }}
            >
              <span className="text-xs uppercase tracking-[0.3em] text-white/40">{vehicle.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold tracking-tight">{vehicle.name}</h3>
            <p className="text-sm text-white/55">{vehicle.tagline}</p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/20 text-lg transition group-hover:border-white/50 group-hover:bg-white/10"
          >
            →
          </span>
        </div>
        <p className="px-6 pb-5 text-xs font-semibold uppercase tracking-wide text-white/40">
          From {formatPriceCents(vehicle.basePriceCents, vehicle.currency)}
        </p>
      </Link>
    </motion.div>
  );
}
