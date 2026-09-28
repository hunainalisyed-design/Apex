import type { Metadata } from "next";
import { CompareView } from "@/components/compare/CompareView";

const DESCRIPTION = "Compare two Apex models side by side — specs, options, and price.";

export const metadata: Metadata = {
  title: "Compare Vehicles",
  description: DESCRIPTION,
  openGraph: { title: "Compare Vehicles | APEX", description: DESCRIPTION },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string | string[]; right?: string | string[] }>;
}) {
  const { left, right } = await searchParams;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-full flex-1 flex-col gap-10 bg-navy-900 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,var(--color-navy-700)_0%,var(--color-navy-800)_45%,var(--color-navy-900)_100%)] px-6 py-16 text-ink"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-secondary">Compare</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Compare Vehicles
        </h1>
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <CompareView
          initialLeftSlug={typeof left === "string" ? left : undefined}
          initialRightSlug={typeof right === "string" ? right : undefined}
        />
      </div>
    </main>
  );
}
