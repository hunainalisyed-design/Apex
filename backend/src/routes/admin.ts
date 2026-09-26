import { Router, type Response } from "express";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { recordAuditLog } from "../services/admin/auditLog.js";
import { recordAssetVersionChanges } from "../services/assets/changes.js";
import { listLeads, updateLeadStatus } from "../services/admin/leads.js";
import { createOption, deactivateOption, listOptions, updateOption } from "../services/admin/options.js";
import { listReservations } from "../services/admin/reservations.js";
import { createVehicle, listVehicles, updateVehicle } from "../services/admin/vehicles.js";
import { unpublishConfiguration } from "../services/gallery.js";
import { ALL_CATEGORIES, type ApplyMode, type OptionCategory } from "../types/catalog.js";
import type { ApiResponse } from "../types/api.js";
import type {
  CreateOptionRequest,
  CreateVehicleRequest,
  UpdateLeadStatusRequest,
  UpdateOptionRequest,
  UpdateVehicleRequest,
} from "../types/admin.js";

export const adminRouter = Router();

const APPLY_MODES: ApplyMode[] = ["MATERIAL_SWAP", "MESH_VARIANT_SWAP", "MESH_VISIBILITY"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** Spec 25, AC-1/AC-2 — an asset URL an admin set isn't content-addressed. Reuses the
 * existing VALIDATION_ERROR code; the per-field details say exactly which URL and why. */
function sendUnversionedAssetError(res: Response, errors: Record<string, string[]>) {
  sendApiError(res, 400, "VALIDATION_ERROR", "Asset URLs must be versioned.", errors);
}

// ---------------------------------------------------------------------------------------
// Vehicles (AC-2) — GET (list) isn't in the spec's original endpoint table; added because
// there's no way to build/use an edit UI without a way to list what to edit. See
// docs/specs/21-admin-cms-panel.md's "API contract" note on this addition.
// ---------------------------------------------------------------------------------------

adminRouter.get(
  "/admin/vehicles",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const vehicles = await listVehicles(req.query);
    res.status(200).json({ data: vehicles } satisfies ApiResponse<unknown>);
  }),
);

function validateCreateVehicleBody(body: unknown): { errors: Record<string, string[]> } | { value: CreateVehicleRequest } {
  const b = body as Partial<CreateVehicleRequest> | undefined;
  const errors: Record<string, string[]> = {};

  if (!b || !isNonEmptyString(b.slug)) errors.slug = ["slug is required."];
  if (!b || !isNonEmptyString(b.name)) errors.name = ["name is required."];
  if (!b || !isNonEmptyString(b.tagline)) errors.tagline = ["tagline is required."];
  if (!b || !isInt(b.basePriceCents) || b.basePriceCents < 0) errors.basePriceCents = ["basePriceCents must be a non-negative integer."];
  if (!b || !isNonEmptyString(b.currency)) errors.currency = ["currency is required."];
  if (!b || !isInt(b.horsepower) || b.horsepower < 0) errors.horsepower = ["horsepower must be a non-negative integer."];
  if (!b || !isInt(b.topSpeedKph) || b.topSpeedKph < 0) errors.topSpeedKph = ["topSpeedKph must be a non-negative integer."];
  if (!b || typeof b.zeroToHundredSec !== "number" || b.zeroToHundredSec < 0) errors.zeroToHundredSec = ["zeroToHundredSec must be a non-negative number."];
  if (!b || !isNonEmptyString(b.heroModelUrl)) errors.heroModelUrl = ["heroModelUrl is required."];
  if (!b || !isNonEmptyString(b.showroomModelUrl)) errors.showroomModelUrl = ["showroomModelUrl is required."];
  if (!b || !isNonEmptyString(b.thumbnailUrl)) errors.thumbnailUrl = ["thumbnailUrl is required."];
  if (!b || !isNonEmptyString(b.fallbackImageUrl)) errors.fallbackImageUrl = ["fallbackImageUrl is required."];

  if (Object.keys(errors).length > 0) return { errors };
  return { value: b as CreateVehicleRequest };
}

adminRouter.post(
  "/admin/vehicles",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const validated = validateCreateVehicleBody(req.body);
    if ("errors" in validated) {
      sendApiError(res, 400, "VALIDATION_ERROR", "Invalid vehicle payload.", validated.errors);
      return;
    }

    const result = await createVehicle(validated.value);
    if (!result.ok && result.reason === "UNVERSIONED_ASSET") {
      sendUnversionedAssetError(res, result.errors);
      return;
    }
    if (!result.ok) {
      sendApiError(res, 400, "VALIDATION_ERROR", "A vehicle with this slug already exists.", {
        slug: ["A vehicle with this slug already exists."],
      });
      return;
    }

    await recordAuditLog({
      adminUserId: req.user!.id,
      action: "vehicle.create",
      targetType: "Vehicle",
      targetId: result.vehicle.slug,
    });
    res.status(201).json({ data: result.vehicle } satisfies ApiResponse<unknown>);
  }),
);

function validateUpdateVehicleBody(body: unknown): { errors: Record<string, string[]> } | { value: UpdateVehicleRequest } {
  const b = (body ?? {}) as Partial<UpdateVehicleRequest>;
  const errors: Record<string, string[]> = {};
  const value: UpdateVehicleRequest = {};

  if (b.name !== undefined) {
    if (!isNonEmptyString(b.name)) errors.name = ["name must be a non-empty string."];
    else value.name = b.name;
  }
  if (b.tagline !== undefined) {
    if (!isNonEmptyString(b.tagline)) errors.tagline = ["tagline must be a non-empty string."];
    else value.tagline = b.tagline;
  }
  if (b.basePriceCents !== undefined) {
    if (!isInt(b.basePriceCents) || b.basePriceCents < 0) errors.basePriceCents = ["basePriceCents must be a non-negative integer."];
    else value.basePriceCents = b.basePriceCents;
  }
  if (b.currency !== undefined) {
    if (!isNonEmptyString(b.currency)) errors.currency = ["currency must be a non-empty string."];
    else value.currency = b.currency;
  }
  if (b.horsepower !== undefined) {
    if (!isInt(b.horsepower) || b.horsepower < 0) errors.horsepower = ["horsepower must be a non-negative integer."];
    else value.horsepower = b.horsepower;
  }
  if (b.topSpeedKph !== undefined) {
    if (!isInt(b.topSpeedKph) || b.topSpeedKph < 0) errors.topSpeedKph = ["topSpeedKph must be a non-negative integer."];
    else value.topSpeedKph = b.topSpeedKph;
  }
  if (b.zeroToHundredSec !== undefined) {
    if (typeof b.zeroToHundredSec !== "number" || b.zeroToHundredSec < 0) errors.zeroToHundredSec = ["zeroToHundredSec must be a non-negative number."];
    else value.zeroToHundredSec = b.zeroToHundredSec;
  }
  if (b.heroModelUrl !== undefined) {
    if (!isNonEmptyString(b.heroModelUrl)) errors.heroModelUrl = ["heroModelUrl must be a non-empty string."];
    else value.heroModelUrl = b.heroModelUrl;
  }
  if (b.showroomModelUrl !== undefined) {
    if (!isNonEmptyString(b.showroomModelUrl)) errors.showroomModelUrl = ["showroomModelUrl must be a non-empty string."];
    else value.showroomModelUrl = b.showroomModelUrl;
  }
  if (b.thumbnailUrl !== undefined) {
    if (!isNonEmptyString(b.thumbnailUrl)) errors.thumbnailUrl = ["thumbnailUrl must be a non-empty string."];
    else value.thumbnailUrl = b.thumbnailUrl;
  }
  if (b.fallbackImageUrl !== undefined) {
    if (!isNonEmptyString(b.fallbackImageUrl)) errors.fallbackImageUrl = ["fallbackImageUrl must be a non-empty string."];
    else value.fallbackImageUrl = b.fallbackImageUrl;
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") errors.isActive = ["isActive must be a boolean."];
    else value.isActive = b.isActive;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { value };
}

adminRouter.put(
  "/admin/vehicles/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const validated = validateUpdateVehicleBody(req.body);
    if ("errors" in validated) {
      sendApiError(res, 400, "VALIDATION_ERROR", "Invalid vehicle payload.", validated.errors);
      return;
    }

    const result = await updateVehicle(req.params.id, validated.value);
    if (!result.ok) {
      if (result.reason === "UNVERSIONED_ASSET") {
        sendUnversionedAssetError(res, result.errors);
        return;
      }
      sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this ID.");
      return;
    }

    await recordAuditLog({
      adminUserId: req.user!.id,
      action: "vehicle.update",
      targetType: "Vehicle",
      targetId: req.params.id,
      metadata: { ...validated.value } as Record<string, unknown>,
    });
    await recordAssetVersionChanges(req.user!.id, "Vehicle", req.params.id, result.assetChanges);
    res.status(200).json({ data: result.vehicle } satisfies ApiResponse<unknown>);
  }),
);

// ---------------------------------------------------------------------------------------
// CustomizationOptions (AC-3) — GET (list) same addition-note as vehicles above.
// ---------------------------------------------------------------------------------------

adminRouter.get(
  "/admin/vehicles/:id/options",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const options = await listOptions(req.params.id);
    res.status(200).json({ data: options } satisfies ApiResponse<unknown>);
  }),
);

function validateCreateOptionBody(body: unknown): { errors: Record<string, string[]> } | { value: CreateOptionRequest } {
  const b = body as Partial<CreateOptionRequest> | undefined;
  const errors: Record<string, string[]> = {};

  if (!b || !ALL_CATEGORIES.includes(b.category as OptionCategory)) errors.category = ["category must be a valid option category."];
  if (!b || !isNonEmptyString(b.name)) errors.name = ["name is required."];
  if (b && b.description !== null && b.description !== undefined && typeof b.description !== "string") {
    errors.description = ["description must be a string or null."];
  }
  if (!b || !isInt(b.priceDeltaCents)) errors.priceDeltaCents = ["priceDeltaCents must be an integer."];
  if (!b || !isNonEmptyString(b.assetRef)) errors.assetRef = ["assetRef is required."];
  if (b && b.swatchColor !== null && b.swatchColor !== undefined && typeof b.swatchColor !== "string") {
    errors.swatchColor = ["swatchColor must be a string or null."];
  }
  if (!b || !APPLY_MODES.includes(b.applyMode as ApplyMode)) errors.applyMode = ["applyMode must be a valid apply mode."];
  if (!b || typeof b.isDefault !== "boolean") errors.isDefault = ["isDefault must be a boolean."];
  if (b?.sortOrder !== undefined && !isInt(b.sortOrder)) errors.sortOrder = ["sortOrder must be an integer."];

  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      category: b!.category as OptionCategory,
      name: b!.name as string,
      description: (b!.description as string | null) ?? null,
      priceDeltaCents: b!.priceDeltaCents as number,
      assetRef: b!.assetRef as string,
      swatchColor: (b!.swatchColor as string | null) ?? null,
      applyMode: b!.applyMode as ApplyMode,
      isDefault: b!.isDefault as boolean,
      sortOrder: b!.sortOrder,
    },
  };
}

adminRouter.post(
  "/admin/vehicles/:id/options",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const validated = validateCreateOptionBody(req.body);
    if ("errors" in validated) {
      sendApiError(res, 400, "VALIDATION_ERROR", "Invalid option payload.", validated.errors);
      return;
    }

    const result = await createOption(req.params.id, validated.value);
    if (!result.ok) {
      if (result.reason === "VEHICLE_NOT_FOUND") {
        sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this ID.");
        return;
      }
      if (result.reason === "UNVERSIONED_ASSET") {
        sendUnversionedAssetError(res, result.errors);
        return;
      }
      sendApiError(res, 400, "VALIDATION_ERROR", result.message, { isDefault: [result.message] });
      return;
    }

    await recordAuditLog({
      adminUserId: req.user!.id,
      action: "option.create",
      targetType: "CustomizationOption",
      targetId: result.option.id,
    });
    res.status(201).json({ data: result.option } satisfies ApiResponse<unknown>);
  }),
);

function validateUpdateOptionBody(body: unknown): { errors: Record<string, string[]> } | { value: UpdateOptionRequest } {
  const b = (body ?? {}) as Partial<UpdateOptionRequest>;
  const errors: Record<string, string[]> = {};
  const value: UpdateOptionRequest = {};

  if (b.name !== undefined) {
    if (!isNonEmptyString(b.name)) errors.name = ["name must be a non-empty string."];
    else value.name = b.name;
  }
  if (b.description !== undefined) {
    if (b.description !== null && typeof b.description !== "string") errors.description = ["description must be a string or null."];
    else value.description = b.description;
  }
  if (b.priceDeltaCents !== undefined) {
    if (!isInt(b.priceDeltaCents)) errors.priceDeltaCents = ["priceDeltaCents must be an integer."];
    else value.priceDeltaCents = b.priceDeltaCents;
  }
  if (b.assetRef !== undefined) {
    if (!isNonEmptyString(b.assetRef)) errors.assetRef = ["assetRef must be a non-empty string."];
    else value.assetRef = b.assetRef;
  }
  if (b.swatchColor !== undefined) {
    if (b.swatchColor !== null && typeof b.swatchColor !== "string") errors.swatchColor = ["swatchColor must be a string or null."];
    else value.swatchColor = b.swatchColor;
  }
  if (b.applyMode !== undefined) {
    if (!APPLY_MODES.includes(b.applyMode)) errors.applyMode = ["applyMode must be a valid apply mode."];
    else value.applyMode = b.applyMode;
  }
  if (b.isDefault !== undefined) {
    if (typeof b.isDefault !== "boolean") errors.isDefault = ["isDefault must be a boolean."];
    else value.isDefault = b.isDefault;
  }
  if (b.sortOrder !== undefined) {
    if (!isInt(b.sortOrder)) errors.sortOrder = ["sortOrder must be an integer."];
    else value.sortOrder = b.sortOrder;
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") errors.isActive = ["isActive must be a boolean."];
    else value.isActive = b.isActive;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { value };
}

adminRouter.put(
  "/admin/options/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const validated = validateUpdateOptionBody(req.body);
    if ("errors" in validated) {
      sendApiError(res, 400, "VALIDATION_ERROR", "Invalid option payload.", validated.errors);
      return;
    }

    const result = await updateOption(req.params.id, validated.value);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        sendApiError(res, 404, "OPTION_NOT_FOUND", "No option matches this ID.");
        return;
      }
      if (result.reason === "UNVERSIONED_ASSET") {
        sendUnversionedAssetError(res, result.errors);
        return;
      }
      sendApiError(res, 400, "VALIDATION_ERROR", result.message, { isDefault: [result.message] });
      return;
    }

    await recordAuditLog({
      adminUserId: req.user!.id,
      action: "option.update",
      targetType: "CustomizationOption",
      targetId: req.params.id,
      metadata: { ...validated.value } as Record<string, unknown>,
    });
    await recordAssetVersionChanges(req.user!.id, "CustomizationOption", req.params.id, result.assetChanges);
    res.status(200).json({ data: result.option } satisfies ApiResponse<unknown>);
  }),
);

adminRouter.delete(
  "/admin/options/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await deactivateOption(req.params.id);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        sendApiError(res, 404, "OPTION_NOT_FOUND", "No option matches this ID.");
        return;
      }
      // Unreachable in practice (deactivation never sets assetRef) — narrows the union.
      if (result.reason === "UNVERSIONED_ASSET") {
        sendUnversionedAssetError(res, result.errors);
        return;
      }
      sendApiError(res, 400, "VALIDATION_ERROR", result.message, { isDefault: [result.message] });
      return;
    }

    await recordAuditLog({
      adminUserId: req.user!.id,
      action: "option.deactivate",
      targetType: "CustomizationOption",
      targetId: req.params.id,
    });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------------------
// Gallery (Spec 31) — the moderation safety valve: gallery images are uploaded by the
// publisher's browser, so an admin can take any build out of the public gallery.
// ---------------------------------------------------------------------------------------

adminRouter.post(
  "/admin/gallery/:publicId/unpublish",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await unpublishConfiguration(req.params.publicId, null);
    if (!result.ok) {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
      return;
    }
    await recordAuditLog({
      adminUserId: req.user!.id,
      action: "gallery.unpublish",
      targetType: "Configuration",
      targetId: req.params.publicId,
    });
    res.status(200).json({ data: result.status } satisfies ApiResponse<unknown>);
  }),
);

// ---------------------------------------------------------------------------------------
// Leads (AC-4)
// ---------------------------------------------------------------------------------------

adminRouter.get(
  "/admin/leads",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    if (status !== undefined && status !== "NEW" && status !== "CONTACTED" && status !== "CLOSED") {
      sendApiError(res, 400, "VALIDATION_ERROR", "status must be NEW, CONTACTED, or CLOSED.");
      return;
    }

    const leads = await listLeads({ status: status as "NEW" | "CONTACTED" | "CLOSED" | undefined }, req.query);
    res.status(200).json({ data: leads } satisfies ApiResponse<unknown>);
  }),
);

adminRouter.put(
  "/admin/leads/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<UpdateLeadStatusRequest> | undefined;
    if (!body || (body.status !== "CONTACTED" && body.status !== "CLOSED")) {
      sendApiError(res, 400, "VALIDATION_ERROR", "status must be CONTACTED or CLOSED.", {
        status: ["status must be CONTACTED or CLOSED."],
      });
      return;
    }

    const result = await updateLeadStatus(req.params.id, body.status);
    if (!result.ok) {
      sendApiError(res, 404, "LEAD_NOT_FOUND", "No lead matches this ID.");
      return;
    }

    await recordAuditLog({
      adminUserId: req.user!.id,
      action: "lead.updateStatus",
      targetType: "Lead",
      targetId: req.params.id,
      metadata: { status: body.status },
    });
    res.status(200).json({ data: result.lead } satisfies ApiResponse<unknown>);
  }),
);

// ---------------------------------------------------------------------------------------
// Reservations (AC-5) — read-only
// ---------------------------------------------------------------------------------------

adminRouter.get(
  "/admin/reservations",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const reservations = await listReservations(req.query);
    res.status(200).json({ data: reservations } satisfies ApiResponse<unknown>);
  }),
);
