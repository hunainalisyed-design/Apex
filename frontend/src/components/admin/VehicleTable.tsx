"use client";

import { useState } from "react";
import { formatPriceCents } from "@/lib/format/currency";
import { useAdminVehiclesStore } from "@/state/adminVehiclesStore";
import type { VehicleAdminDto } from "@/types/admin";
import { VehicleFormDialog } from "./VehicleFormDialog";

export interface VehicleTableProps {
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string) => void;
}

/** Admin vehicle list (Spec 21 AC-2) — create/edit via VehicleFormDialog, deactivate/
 * reactivate as a quick isActive toggle (no confirmation needed here: a vehicle deactivation
 * is fully reversible, unlike Spec 21 AC-3's option deactivation which affects saved builds
 * and gets its own confirm step in OptionTable). */
export function VehicleTable({ selectedVehicleId, onSelectVehicle }: VehicleTableProps) {
  const status = useAdminVehiclesStore((s) => s.status);
  const vehicles = useAdminVehiclesStore((s) => s.vehicles);
  const error = useAdminVehiclesStore((s) => s.error);
  const load = useAdminVehiclesStore((s) => s.load);
  const update = useAdminVehiclesStore((s) => s.update);

  const [dialogState, setDialogState] = useState<{ open: boolean; vehicle?: VehicleAdminDto }>({ open: false });

  if (status === "loading") return <p className="text-sm text-white/50">Loading vehicles…</p>;

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDialogState({ open: true })}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90"
        >
          Add Vehicle
        </button>
      </div>

      {status === "success" && vehicles.length === 0 && <p className="text-sm text-white/50">No vehicles yet.</p>}

      {status === "success" && vehicles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <caption className="sr-only">Vehicles</caption>
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Name</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Slug</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Price</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Status</th>
                <th scope="col" className="py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className={`border-b border-white/5 ${selectedVehicleId === vehicle.id ? "bg-white/[0.04]" : ""}`}>
                  <td className="py-2 pr-4 text-white/90">{vehicle.name}</td>
                  <td className="py-2 pr-4 text-white/70">{vehicle.slug}</td>
                  <td className="py-2 pr-4 text-white/70">{formatPriceCents(vehicle.basePriceCents, vehicle.currency)}</td>
                  <td className="py-2 pr-4 text-white/70">{vehicle.isActive ? "Active" : "Deactivated"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(vehicle.id)}
                        aria-pressed={selectedVehicleId === vehicle.id}
                        className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white"
                      >
                        Options
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialogState({ open: true, vehicle })}
                        className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => update(vehicle.id, { isActive: !vehicle.isActive })}
                        className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white"
                      >
                        {vehicle.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogState.open && (
        <VehicleFormDialog vehicle={dialogState.vehicle} onClose={() => setDialogState({ open: false })} />
      )}
    </div>
  );
}
