import { GalleryModeration } from "@/components/admin/GalleryModeration";

export default function AdminGalleryPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Gallery
        </h1>
        <p className="text-sm text-white/60">
          Published community builds. Unpublishing removes a build from the gallery immediately; its owner can republish
          it.
        </p>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <GalleryModeration />
      </div>
    </main>
  );
}
