import type { Metadata } from "next";

const DESCRIPTION =
  "A cinematic virtual configurator built to demonstrate a real-time 3D customization and pricing experience.";

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  openGraph: { title: "About | APEX", description: DESCRIPTION },
};

export default function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col items-center gap-6 px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">About</p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
        Apex
      </h1>
      <p className="max-w-xl text-balance text-white/70">
        A cinematic virtual configurator built to demonstrate a real-time 3D customization
        and pricing experience — customize, price, and share a build in a single session.
      </p>
    </main>
  );
}
