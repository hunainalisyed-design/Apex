"use client";

import { useEffect } from "react";
import { galleryImageSrc } from "@/lib/api/gallery";
import { formatSavedDate } from "@/lib/format/date";
import { useAdminGalleryStore } from "@/state/adminGalleryStore";

/**
 * The gallery's moderation safety valve (Spec 31, Risk #1): gallery images are captured in the
 * owner's browser, so the server can check their format and size but not their pixels. Lists
 * what's published, newest first, and takes any entry down with one click.
 */
export function GalleryModeration() {
  const status = useAdminGalleryStore((s) => s.status);
  const entries = useAdminGalleryStore((s) => s.entries);
  const hasMore = useAdminGalleryStore((s) => s.hasMore);
  const error = useAdminGalleryStore((s) => s.error);
  const removingId = useAdminGalleryStore((s) => s.removingId);
  const rowError = useAdminGalleryStore((s) => s.rowError);
  const load = useAdminGalleryStore((s) => s.load);
  const loadMore = useAdminGalleryStore((s) => s.loadMore);
  const unpublish = useAdminGalleryStore((s) => s.unpublish);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "idle" || status === "loading")
    return <p className="text-sm text-white/60">Loading published builds…</p>;
  if (status === "error") {
    return (
      <div role="alert" className="flex items-center gap-3 text-sm text-red-300">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-red-300/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-red-300/10 focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }
  if (entries.length === 0) return <p className="text-sm text-white/60">Nothing is published right now.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.publicId} className="glass-panel flex items-center gap-4 rounded-2xl p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the API */}
            <img
              src={galleryImageSrc(entry.captureImageUrl)}
              alt={`${entry.vehicleName} build`}
              className="aspect-video w-40 shrink-0 rounded-lg object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <p className="font-semibold text-white">{entry.vehicleName}</p>
              <p className="font-mono text-xs text-white/50">{entry.publicId}</p>
              <p className="text-xs text-white/50">
                Published {formatSavedDate(entry.publishedAt)} · {entry.likeCount}{" "}
                {entry.likeCount === 1 ? "like" : "likes"}
              </p>
              {rowError?.publicId === entry.publicId && <p className="text-xs text-red-300">{rowError.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => void unpublish(entry.publicId)}
              disabled={removingId !== null}
              aria-label={`Unpublish ${entry.vehicleName} build ${entry.publicId}`}
              className="shrink-0 rounded-full bg-red-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
            >
              {removingId === entry.publicId ? "Removing…" : "Unpublish"}
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          className="self-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 hover:border-white/50 hover:text-white focus-ring"
        >
          Load More
        </button>
      )}
    </div>
  );
}
