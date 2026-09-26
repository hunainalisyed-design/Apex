import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GalleryView } from "@/components/gallery/GalleryView";
import { getDefaultVehicleSlug } from "@/lib/api/vehicles";

const DESCRIPTION = "Community builds published by Apex owners — browse, and like the ones you would drive.";

export const metadata: Metadata = {
  title: "Community Builds",
  description: DESCRIPTION,
  openGraph: { title: "Community Builds | APEX", description: DESCRIPTION },
};

/** The public build gallery (Spec 31) — browsing needs no account; liking does (AC-4). */
export default async function GalleryPage() {
  const t = await getTranslations("gallery");
  const defaultVehicleSlug = await getDefaultVehicleSlug();
  const configureHref = defaultVehicleSlug ? `/configure/${defaultVehicleSlug}` : "/models";

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">{t("eyebrow")}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          {t("title")}
        </h1>
        <p className="text-sm text-white/60">{t("intro")}</p>
      </div>
      <div className="mx-auto w-full max-w-5xl">
        <GalleryView configureHref={configureHref} />
      </div>
    </main>
  );
}
