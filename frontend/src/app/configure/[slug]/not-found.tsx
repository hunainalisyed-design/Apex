import Link from "next/link";
import { useTranslations } from "next-intl";

export default function VehicleNotFound() {
  const t = useTranslations("shell");
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="glass-panel flex max-w-xl flex-col items-center gap-4 rounded-2xl px-10 py-14">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">{t("eyebrow")}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("vehicleNotFound.title")}
        </h1>
        <Link
          href="/models"
          className="focus-ring rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          {t("vehicleNotFound.backToModels")}
        </Link>
      </div>
    </main>
  );
}
