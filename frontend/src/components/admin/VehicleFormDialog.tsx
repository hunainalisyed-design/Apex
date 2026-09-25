"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { saveErrorBanner } from "@/lib/admin/saveErrorBanner";
import { useAdminVehiclesStore } from "@/state/adminVehiclesStore";
import type { VehicleAdminDto } from "@/types/admin";

// Fields whose save errors render inline on their own FormField (see saveErrorBanner).
const INLINE_ERROR_FIELDS = ["slug", "heroModelUrl", "showroomModelUrl", "thumbnailUrl", "fallbackImageUrl"] as const;

export interface VehicleFormDialogProps {
  /** Absent = create; present = edit (slug becomes read-only, matching UpdateVehicleRequest
   * not accepting a slug change). */
  vehicle?: VehicleAdminDto;
  onClose: () => void;
}

function fieldsFrom(vehicle?: VehicleAdminDto) {
  return {
    slug: vehicle?.slug ?? "",
    name: vehicle?.name ?? "",
    tagline: vehicle?.tagline ?? "",
    basePriceCents: vehicle ? String(vehicle.basePriceCents) : "",
    currency: vehicle?.currency ?? "EUR",
    horsepower: vehicle ? String(vehicle.horsepower) : "",
    topSpeedKph: vehicle ? String(vehicle.topSpeedKph) : "",
    zeroToHundredSec: vehicle ? String(vehicle.zeroToHundredSec) : "",
    heroModelUrl: vehicle?.heroModelUrl ?? "",
    showroomModelUrl: vehicle?.showroomModelUrl ?? "",
    thumbnailUrl: vehicle?.thumbnailUrl ?? "",
    fallbackImageUrl: vehicle?.fallbackImageUrl ?? "",
  };
}

/** Create/edit form for a catalog Vehicle (Spec 21 AC-2) — templated on
 * LeadRequestDialog.tsx's modal pattern (role="dialog", useFocusTrap, idle/saving/error
 * status). Prices are entered as raw integer cents, matching this codebase's own money
 * convention (docs/CLAUDE.md: money is always an integer number of cents) rather than
 * converting from a decimal display value and risking a rounding bug in an admin tool. */
export function VehicleFormDialog({ vehicle, onClose }: VehicleFormDialogProps) {
  const isEdit = !!vehicle;
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const create = useAdminVehiclesStore((s) => s.create);
  const update = useAdminVehiclesStore((s) => s.update);
  const isSaving = useAdminVehiclesStore((s) => s.isSaving);
  const saveError = useAdminVehiclesStore((s) => s.saveError);
  const saveErrorDetails = useAdminVehiclesStore((s) => s.saveErrorDetails);

  const [fields, setFields] = useState(fieldsFrom(vehicle));
  const [localError, setLocalError] = useState<string | null>(null);

  useFocusTrap(dialogRef, true, onClose);

  function set<K extends keyof typeof fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const basePriceCents = Number(fields.basePriceCents);
    const horsepower = Number(fields.horsepower);
    const topSpeedKph = Number(fields.topSpeedKph);
    const zeroToHundredSec = Number(fields.zeroToHundredSec);

    if (
      !Number.isInteger(basePriceCents) ||
      !Number.isInteger(horsepower) ||
      !Number.isInteger(topSpeedKph) ||
      !Number.isFinite(zeroToHundredSec)
    ) {
      setLocalError("Price, horsepower, and top speed must be whole numbers; 0-100s must be a number.");
      return;
    }

    const ok = isEdit
      ? await update(vehicle.id, {
          name: fields.name,
          tagline: fields.tagline,
          basePriceCents,
          currency: fields.currency,
          horsepower,
          topSpeedKph,
          zeroToHundredSec,
          heroModelUrl: fields.heroModelUrl,
          showroomModelUrl: fields.showroomModelUrl,
          thumbnailUrl: fields.thumbnailUrl,
          fallbackImageUrl: fields.fallbackImageUrl,
        })
      : await create({
          slug: fields.slug,
          name: fields.name,
          tagline: fields.tagline,
          basePriceCents,
          currency: fields.currency,
          horsepower,
          topSpeedKph,
          zeroToHundredSec,
          heroModelUrl: fields.heroModelUrl,
          showroomModelUrl: fields.showroomModelUrl || fields.heroModelUrl,
          thumbnailUrl: fields.thumbnailUrl,
          fallbackImageUrl: fields.fallbackImageUrl,
        });

    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-6 py-10" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex w-full max-w-lg flex-col gap-4 rounded-2xl p-6"
      >
        <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
          {isEdit ? `Edit ${vehicle.name}` : "New Vehicle"}
        </h2>

        {(localError || saveError) && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {localError ?? saveErrorBanner(saveError, saveErrorDetails, INLINE_ERROR_FIELDS)}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <FormField
            label="Slug"
            name="slug"
            errors={saveErrorDetails?.slug}
            value={fields.slug}
            onChange={(e) => set("slug", e.target.value)}
            disabled={isEdit}
            required
          />
          <FormField label="Name" name="name" value={fields.name} onChange={(e) => set("name", e.target.value)} required />
          <FormField
            label="Tagline"
            name="tagline"
            value={fields.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Base price (cents)"
              name="basePriceCents"
              type="number"
              value={fields.basePriceCents}
              onChange={(e) => set("basePriceCents", e.target.value)}
              required
            />
            <FormField
              label="Currency"
              name="currency"
              value={fields.currency}
              onChange={(e) => set("currency", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField
              label="Horsepower"
              name="horsepower"
              type="number"
              value={fields.horsepower}
              onChange={(e) => set("horsepower", e.target.value)}
              required
            />
            <FormField
              label="Top speed (km/h)"
              name="topSpeedKph"
              type="number"
              value={fields.topSpeedKph}
              onChange={(e) => set("topSpeedKph", e.target.value)}
              required
            />
            <FormField
              label="0-100 (s)"
              name="zeroToHundredSec"
              type="number"
              step="0.1"
              value={fields.zeroToHundredSec}
              onChange={(e) => set("zeroToHundredSec", e.target.value)}
              required
            />
          </div>
          <FormField
            label="Hero model URL"
            name="heroModelUrl"
            errors={saveErrorDetails?.heroModelUrl}
            value={fields.heroModelUrl}
            onChange={(e) => set("heroModelUrl", e.target.value)}
            required
          />
          <FormField
            label={isEdit ? "Showroom model URL" : "Showroom model URL (blank = same as hero)"}
            name="showroomModelUrl"
            errors={saveErrorDetails?.showroomModelUrl}
            value={fields.showroomModelUrl}
            onChange={(e) => set("showroomModelUrl", e.target.value)}
            required={isEdit}
          />
          <FormField
            label="Thumbnail URL"
            name="thumbnailUrl"
            errors={saveErrorDetails?.thumbnailUrl}
            value={fields.thumbnailUrl}
            onChange={(e) => set("thumbnailUrl", e.target.value)}
            required
          />
          <FormField
            label="Fallback image URL"
            name="fallbackImageUrl"
            errors={saveErrorDetails?.fallbackImageUrl}
            value={fields.fallbackImageUrl}
            onChange={(e) => set("fallbackImageUrl", e.target.value)}
            required
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
            >
              {isSaving ? "Saving…" : isEdit ? "Save changes" : "Create vehicle"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
