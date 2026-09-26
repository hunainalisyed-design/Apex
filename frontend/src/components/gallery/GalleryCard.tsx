"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { galleryImageSrc } from "@/lib/api/gallery";
import { formatPriceCents } from "@/lib/format/currency";
import type { GalleryEntryDto } from "@/types/gallery";

export interface GalleryCardProps {
  entry: GalleryEntryDto;
  likePending: boolean;
  onLike: (entry: GalleryEntryDto) => void;
}

/** One published build (Spec 31, AC-2). Deliberately nothing the publisher typed — only the
 * capture image and structured build data (AC-5), and never who published it. */
export function GalleryCard({ entry, likePending, onLike }: GalleryCardProps) {
  const t = useTranslations("gallery");

  return (
    <article className="glass-panel flex flex-col overflow-hidden rounded-2xl" data-testid="gallery-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, content-addressed and immutable-cached there */}
      <img
        src={galleryImageSrc(entry.captureImageUrl)}
        alt={t("imageAlt", { vehicle: entry.vehicleName })}
        width={1600}
        height={900}
        loading="lazy"
        className="aspect-video w-full bg-white/5 object-cover"
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">{entry.vehicleName}</h2>
          <p className="text-xs text-white/60">{formatPriceCents(entry.totalPriceCents, entry.currency)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLike(entry)}
            disabled={likePending}
            aria-pressed={entry.likedByMe}
            aria-label={t("likeBuild", { vehicle: entry.vehicleName })}
            className={`focus-ring flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-wait ${
              entry.likedByMe
                ? "border-rose-400/60 bg-rose-400/15 text-rose-200"
                : "border-white/20 text-white/80 hover:border-white/50 hover:text-white"
            }`}
          >
            <span aria-hidden="true">{entry.likedByMe ? "♥" : "♡"}</span>
            {t("like")}
          </button>
          <span className="text-xs text-white/60" data-testid="like-count">
            {t("likeCount", { count: entry.likeCount })}
          </span>
          <Link
            href={`/configure/${entry.vehicleSlug}?build=${entry.publicId}`}
            className="focus-ring ml-auto rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            {t("viewBuild")}
          </Link>
        </div>
      </div>
    </article>
  );
}
