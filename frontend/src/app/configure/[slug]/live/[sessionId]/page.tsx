import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfigureShowroom } from "@/components/showroom/ConfigureShowroom";
import { getEnvironments } from "@/lib/api/environments";
import { getLiveSession, LIVE_COLLAB_ENABLED } from "@/lib/api/liveSessions";
import { getVehicleDetail } from "@/lib/api/vehicles";

type LiveSessionPageProps = {
  params: Promise<{ slug: string; sessionId: string }>;
};

// A live session is a private, short-lived link — never something to index or preview.
export const metadata: Metadata = {
  title: "Live Session",
  robots: { index: false, follow: false },
};

async function LiveSessionUnavailable({ slug, reason }: { slug: string; reason: "notFound" | "unavailable" }) {
  const t = await getTranslations("live");
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="glass-panel flex max-w-xl flex-col items-center gap-4 rounded-2xl px-10 py-14">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">{t("label")}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {reason === "notFound" ? t("notFoundTitle") : t("unavailableTitle")}
        </h1>
        <p className="text-sm text-white/60">{reason === "notFound" ? t("notFoundBody") : t("unavailableBody")}</p>
        <Link
          href={`/configure/${slug}`}
          className="focus-ring rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          {t("startSolo")}
        </Link>
      </div>
    </main>
  );
}

/** /configure/[slug]/live/[sessionId] — the configurator as a live, shared session (Spec 33). */
export default async function LiveSessionPage({ params }: LiveSessionPageProps) {
  const { slug, sessionId } = await params;
  if (!LIVE_COLLAB_ENABLED) return <LiveSessionUnavailable slug={slug} reason="unavailable" />;

  const lookup = await getLiveSession(sessionId);
  if (lookup.status === "notFound") return <LiveSessionUnavailable slug={slug} reason="notFound" />;
  if (lookup.status !== "open") return <LiveSessionUnavailable slug={slug} reason="unavailable" />;

  // The session knows its vehicle; a link with the wrong slug still lands on the right car.
  if (lookup.session.vehicleSlug !== slug) redirect(`/configure/${lookup.session.vehicleSlug}/live/${sessionId}`);

  const [vehicle, environments] = await Promise.all([getVehicleDetail(slug), getEnvironments()]);
  if (!vehicle) notFound();

  return <ConfigureShowroom vehicle={vehicle} environments={environments} liveSessionId={sessionId} />;
}
