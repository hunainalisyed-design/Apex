"use client";

import { formatPriceCents } from "@/lib/format/currency";
import { useAdminReservationsStore } from "@/state/adminReservationsStore";

/** Admin reservation list — read-only (Spec 21 AC-5): status only ever changes via the
 * Stripe webhook, so this table has no edit affordance at all. */
export function ReservationsTable() {
  const status = useAdminReservationsStore((s) => s.status);
  const reservations = useAdminReservationsStore((s) => s.reservations);
  const error = useAdminReservationsStore((s) => s.error);
  const load = useAdminReservationsStore((s) => s.load);

  if (status === "loading") return <p className="text-sm text-white/50">Loading reservations…</p>;

  if (status === "error") {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <span>{error}</span>
        <button type="button" onClick={() => load()} className="focus-ring underline">
          Retry
        </button>
      </div>
    );
  }

  if (status === "success" && reservations.length === 0) {
    return <p className="text-sm text-white/50">No reservations yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">Reservations</caption>
        <thead>
          <tr className="border-b border-white/10">
            <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Build</th>
            <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Vehicle</th>
            <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Amount</th>
            <th scope="col" className="py-2 text-left text-xs uppercase tracking-wide text-white/50">Status</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr key={r.id} className="border-b border-white/5">
              <td className="py-2 pr-4 text-white/90">{r.configurationPublicId}</td>
              <td className="py-2 pr-4 text-white/70">{r.vehicleSlug}</td>
              <td className="py-2 pr-4 text-white/70">{formatPriceCents(r.amountCents, r.currency)}</td>
              <td className="py-2 text-white/70">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
