import { SystemStatus } from "@/components/shell/SystemStatus";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="glass-panel flex max-w-2xl flex-col items-center gap-6 rounded-2xl px-10 py-14">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Apex Showroom</p>
        <h1
          className="text-4xl font-bold tracking-tight sm:text-6xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          BUILD YOUR VISION.
        </h1>
        <p className="max-w-md text-balance text-white/70">
          Configure every detail of your vehicle in an immersive 3D experience. The
          showroom is under construction — check back soon.
        </p>
        <SystemStatus />
      </div>
    </main>
  );
}
