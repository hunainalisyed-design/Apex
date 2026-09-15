"use client";

import { useEffect } from "react";
import { ReservationsTable } from "@/components/admin/ReservationsTable";
import { useAdminReservationsStore } from "@/state/adminReservationsStore";

export default function AdminReservationsPage() {
  const load = useAdminReservationsStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Reservations
        </h1>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <ReservationsTable />
      </div>
    </main>
  );
}
