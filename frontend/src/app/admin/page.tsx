import Link from "next/link";

const SECTIONS = [
  { href: "/admin/vehicles", label: "Vehicles & Options", description: "Create, edit, and deactivate catalog vehicles and their customization options." },
  { href: "/admin/leads", label: "Leads", description: "Review quote and test-drive requests." },
  { href: "/admin/reservations", label: "Reservations", description: "View deposit reservations (read-only)." },
] as const;

/** No special design polish required beyond functional clarity (Spec 21 §5) — internal
 * tooling, not the customer-facing product surface. */
export default function AdminIndexPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Admin Panel
        </h1>
      </div>

      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="focus-ring glass-panel flex flex-col gap-2 rounded-2xl p-6 transition hover:bg-white/[0.06]"
          >
            <h2 className="text-lg font-bold tracking-tight">{section.label}</h2>
            <p className="text-sm text-white/60">{section.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
