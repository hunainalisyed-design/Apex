"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/shell/ToastProvider";
import type { GallerySort } from "@/lib/api/gallery";
import { useAuthStore } from "@/state/authStore";
import { useGalleryStore } from "@/state/galleryStore";
import type { GalleryEntryDto } from "@/types/gallery";
import { GalleryCard } from "./GalleryCard";
import { SignInPromptDialog } from "./SignInPromptDialog";

const SORTS: GallerySort[] = ["recent", "popular"];

function SkeletonCard() {
  return (
    <div className="glass-panel flex flex-col overflow-hidden rounded-2xl" data-testid="gallery-skeleton">
      <div className="aspect-video w-full animate-pulse bg-white/5" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  );
}

export interface GalleryViewProps {
  /** Where the empty state's "Start Configuring" goes (the default vehicle, or /models). */
  configureHref: string;
}

/**
 * The public gallery (Spec 31): sortable, paged card grid with like toggles. It loads in the
 * browser, with the session cookie, so each card's likedByMe reflects the viewer — the page
 * itself is public and needs no account; liking prompts a guest to sign in (AC-4).
 */
export function GalleryView({ configureHref }: GalleryViewProps) {
  const t = useTranslations("gallery");
  const { show: showToast } = useToast();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const hydrated = useAuthStore((s) => s.hydrated);

  const sort = useGalleryStore((s) => s.sort);
  const entries = useGalleryStore((s) => s.entries);
  const hasMore = useGalleryStore((s) => s.hasMore);
  const status = useGalleryStore((s) => s.status);
  const error = useGalleryStore((s) => s.error);
  const loadingMore = useGalleryStore((s) => s.loadingMore);
  const loadMoreError = useGalleryStore((s) => s.loadMoreError);
  const pendingLikes = useGalleryStore((s) => s.pendingLikes);
  const load = useGalleryStore((s) => s.load);
  const loadMore = useGalleryStore((s) => s.loadMore);
  const setSort = useGalleryStore((s) => s.setSort);
  const toggleLike = useGalleryStore((s) => s.toggleLike);
  const [promptOpen, setPromptOpen] = useState(false);

  // Waits for auth to hydrate, and reloads when the viewer changes, so likedByMe always
  // reflects who is looking.
  useEffect(() => {
    if (hydrated) void load();
  }, [hydrated, userId, load]);

  const handleLike = useCallback(
    async (entry: GalleryEntryDto) => {
      if (!userId) {
        setPromptOpen(true);
        return;
      }
      if (!(await toggleLike(entry.publicId))) showToast(t("likeFailed"), "assertive");
    },
    [userId, toggleLike, showToast, t],
  );

  const sortLabels: Record<GallerySort, string> = {
    recent: t("sortRecent"),
    popular: t("sortPopular"),
  };
  const isLoading = status === "idle" || status === "loading";

  return (
    <div className="flex flex-col gap-6">
      <div
        role="group"
        aria-label={t("sortLabel")}
        className="glass-panel flex w-fit gap-1 self-center rounded-full p-1"
      >
        {SORTS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={sort === option}
            onClick={() => setSort(option)}
            className={`focus-ring rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              sort === option ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {sortLabels[option]}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="glass-panel mx-auto flex flex-col items-center gap-3 rounded-2xl px-6 py-8 text-center"
        >
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-red-300/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-200 hover:bg-red-300/10 focus-ring"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {status === "success" && entries.length === 0 && (
        <div className="glass-panel mx-auto flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center">
          <p className="text-sm text-white/70">{t("empty")}</p>
          <Link
            href={configureHref}
            className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
          >
            {t("emptyCta")}
          </Link>
        </div>
      )}

      {status === "success" && entries.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <GalleryCard
                key={entry.publicId}
                entry={entry}
                likePending={pendingLikes[entry.publicId] ?? false}
                onLike={handleLike}
              />
            ))}
          </div>
          {loadMoreError && (
            <p role="alert" className="text-center text-xs text-red-300">
              {loadMoreError}
            </p>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="glass-panel self-center rounded-full px-6 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50 focus-ring"
            >
              {loadingMore ? t("loadingMore") : t("loadMore")}
            </button>
          )}
        </>
      )}

      <SignInPromptDialog isOpen={promptOpen} onClose={() => setPromptOpen(false)} />
    </div>
  );
}
