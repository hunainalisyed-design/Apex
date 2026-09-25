"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { saveErrorBanner } from "@/lib/admin/saveErrorBanner";
import { useAdminOptionsStore } from "@/state/adminOptionsStore";
import { ALL_CATEGORIES, type ApplyMode, type OptionCategory } from "@/types/catalog";
import type { OptionAdminDto } from "@/types/admin";

// Fields whose save errors render inline on their own FormField (see saveErrorBanner).
const INLINE_ERROR_FIELDS = ["assetRef"] as const;

export interface OptionFormDialogProps {
  /** Absent = create; present = edit (category becomes read-only — see UpdateOptionRequest's
   * own doc comment for why). */
  option?: OptionAdminDto;
  onClose: () => void;
}

const APPLY_MODES: ApplyMode[] = ["MATERIAL_SWAP", "MESH_VARIANT_SWAP", "MESH_VISIBILITY"];

function fieldsFrom(option?: OptionAdminDto) {
  return {
    category: (option?.category ?? "PAINT") as OptionCategory,
    name: option?.name ?? "",
    description: option?.description ?? "",
    priceDeltaCents: option ? String(option.priceDeltaCents) : "0",
    assetRef: option?.assetRef ?? "",
    swatchColor: option?.swatchColor ?? "",
    applyMode: (option?.applyMode ?? "MATERIAL_SWAP") as ApplyMode,
    isDefault: option?.isDefault ?? false,
  };
}

/** Create/edit form for a CustomizationOption (Spec 21 AC-3) — same modal template as
 * VehicleFormDialog/LeadRequestDialog. Price is entered as raw integer cents, matching this
 * codebase's money convention. */
export function OptionFormDialog({ option, onClose }: OptionFormDialogProps) {
  const isEdit = !!option;
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const create = useAdminOptionsStore((s) => s.create);
  const update = useAdminOptionsStore((s) => s.update);
  const isSaving = useAdminOptionsStore((s) => s.isSaving);
  const saveError = useAdminOptionsStore((s) => s.saveError);
  const saveErrorDetails = useAdminOptionsStore((s) => s.saveErrorDetails);

  const [fields, setFields] = useState(fieldsFrom(option));
  const [localError, setLocalError] = useState<string | null>(null);

  useFocusTrap(dialogRef, true, onClose);

  function set<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const priceDeltaCents = Number(fields.priceDeltaCents);
    if (!Number.isInteger(priceDeltaCents)) {
      setLocalError("Price delta must be a whole number of cents.");
      return;
    }

    const ok = isEdit
      ? await update(option.id, {
          name: fields.name,
          description: fields.description || null,
          priceDeltaCents,
          assetRef: fields.assetRef,
          swatchColor: fields.swatchColor || null,
          applyMode: fields.applyMode,
          isDefault: fields.isDefault,
        })
      : await create({
          category: fields.category,
          name: fields.name,
          description: fields.description || null,
          priceDeltaCents,
          assetRef: fields.assetRef,
          swatchColor: fields.swatchColor || null,
          applyMode: fields.applyMode,
          isDefault: fields.isDefault,
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
          {isEdit ? `Edit ${option.name}` : "New Option"}
        </h2>

        {(localError || saveError) && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {localError ?? saveErrorBanner(saveError, saveErrorDetails, INLINE_ERROR_FIELDS)}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="option-category" className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Category
            </label>
            <select
              id="option-category"
              value={fields.category}
              onChange={(e) => set("category", e.target.value as OptionCategory)}
              disabled={isEdit}
              className="focus-ring rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-black">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <FormField label="Name" name="name" value={fields.name} onChange={(e) => set("name", e.target.value)} required />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="option-description" className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Description (optional)
            </label>
            <textarea
              id="option-description"
              value={fields.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="focus-ring rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Price delta (cents)"
              name="priceDeltaCents"
              type="number"
              value={fields.priceDeltaCents}
              onChange={(e) => set("priceDeltaCents", e.target.value)}
              required
            />
            <FormField
              label="Swatch color (optional)"
              name="swatchColor"
              placeholder="#0a0a0c"
              value={fields.swatchColor}
              onChange={(e) => set("swatchColor", e.target.value)}
            />
          </div>

          <FormField
            label="Asset ref"
            name="assetRef"
            errors={saveErrorDetails?.assetRef}
            value={fields.assetRef}
            onChange={(e) => set("assetRef", e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="option-apply-mode" className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Apply mode
            </label>
            <select
              id="option-apply-mode"
              value={fields.applyMode}
              onChange={(e) => set("applyMode", e.target.value as ApplyMode)}
              className="focus-ring rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              {APPLY_MODES.map((m) => (
                <option key={m} value={m} className="bg-black">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={fields.isDefault} onChange={(e) => set("isDefault", e.target.checked)} />
            Default option for this category
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
            >
              {isSaving ? "Saving…" : isEdit ? "Save changes" : "Create option"}
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
