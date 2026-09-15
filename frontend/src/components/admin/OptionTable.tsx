"use client";

import { useEffect, useState } from "react";
import { formatPriceCents } from "@/lib/format/currency";
import { useAdminOptionsStore } from "@/state/adminOptionsStore";
import type { OptionAdminDto } from "@/types/admin";
import { DeactivateOptionConfirmDialog } from "./DeactivateOptionConfirmDialog";
import { OptionFormDialog } from "./OptionFormDialog";

export interface OptionTableProps {
  vehicleId: string;
  vehicleName: string;
  currency: string;
}

/** Admin CustomizationOption list for one vehicle (Spec 21 AC-3) — create/edit via
 * OptionFormDialog, deactivate (soft-delete) behind DeactivateOptionConfirmDialog. Shows
 * inactive options too (with a visible "Deactivated" state and a reactivate action) since
 * the admin list, unlike the public catalog, is the one place they should still be found. */
export function OptionTable({ vehicleId, vehicleName, currency }: OptionTableProps) {
  const status = useAdminOptionsStore((s) => s.status);
  const options = useAdminOptionsStore((s) => s.options);
  const error = useAdminOptionsStore((s) => s.error);
  const isSaving = useAdminOptionsStore((s) => s.isSaving);
  const saveError = useAdminOptionsStore((s) => s.saveError);
  const loadForVehicle = useAdminOptionsStore((s) => s.loadForVehicle);
  const update = useAdminOptionsStore((s) => s.update);
  const deactivate = useAdminOptionsStore((s) => s.deactivate);

  const [dialogState, setDialogState] = useState<{ open: boolean; option?: OptionAdminDto }>({ open: false });
  const [pendingDeactivate, setPendingDeactivate] = useState<OptionAdminDto | null>(null);

  useEffect(() => {
    void loadForVehicle(vehicleId);
  }, [vehicleId, loadForVehicle]);

  async function handleConfirmDeactivate() {
    if (!pendingDeactivate) return;
    const ok = await deactivate(pendingDeactivate.id);
    if (ok) setPendingDeactivate(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">Options for {vehicleName}</h2>
        <button
          type="button"
          onClick={() => setDialogState({ open: true })}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90"
        >
          Add Option
        </button>
      </div>

      {status === "loading" && <p className="text-sm text-white/50">Loading options…</p>}

      {status === "error" && (
        <div role="alert" className="flex items-center gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => loadForVehicle(vehicleId)} className="focus-ring underline">
            Retry
          </button>
        </div>
      )}

      {status === "success" && options.length === 0 && <p className="text-sm text-white/50">No options yet.</p>}

      {status === "success" && options.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <caption className="sr-only">Options for {vehicleName}</caption>
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Category</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Name</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Price</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Default</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Status</th>
                <th scope="col" className="py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {options.map((option) => (
                <tr key={option.id} className="border-b border-white/5">
                  <td className="py-2 pr-4 text-white/70">{option.category}</td>
                  <td className="py-2 pr-4 text-white/90">{option.name}</td>
                  <td className="py-2 pr-4 text-white/70">{formatPriceCents(option.priceDeltaCents, currency)}</td>
                  <td className="py-2 pr-4 text-white/70">{option.isDefault ? "Yes" : ""}</td>
                  <td className="py-2 pr-4 text-white/70">{option.isActive ? "Active" : "Deactivated"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDialogState({ open: true, option })}
                        className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white"
                      >
                        Edit
                      </button>
                      {option.isActive ? (
                        <button
                          type="button"
                          onClick={() => setPendingDeactivate(option)}
                          className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-red-400/50 hover:text-red-300"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => update(option.id, { isActive: true })}
                          disabled={isSaving}
                          className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogState.open && (
        <OptionFormDialog option={dialogState.option} onClose={() => setDialogState({ open: false })} />
      )}

      {pendingDeactivate && (
        <DeactivateOptionConfirmDialog
          optionName={pendingDeactivate.name}
          isSaving={isSaving}
          error={saveError}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setPendingDeactivate(null)}
        />
      )}
    </div>
  );
}
