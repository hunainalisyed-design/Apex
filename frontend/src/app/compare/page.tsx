import { CompareView } from "@/components/compare/CompareView";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string | string[]; right?: string | string[] }>;
}) {
  const { left, right } = await searchParams;

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Compare</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
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
