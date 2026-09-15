"use client";

import { useEffect, useState } from "react";
import { OptionTable } from "@/components/admin/OptionTable";
import { VehicleTable } from "@/components/admin/VehicleTable";
import { useAdminVehiclesStore } from "@/state/adminVehiclesStore";

export default function AdminVehiclesPage() {
  const load = useAdminVehiclesStore((s) => s.load);
  const vehicles = useAdminVehiclesStore((s) => s.vehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Vehicles & Options
        </h1>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <VehicleTable selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
      </div>

      {selectedVehicle && (
        <div className="mx-auto w-full max-w-5xl">
          <OptionTable vehicleId={selectedVehicle.id} vehicleName={selectedVehicle.name} currency={selectedVehicle.currency} />
        </div>
      )}
    </main>
  );
}
