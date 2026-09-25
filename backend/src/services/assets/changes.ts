import { logger } from "../../lib/logger.js";
import { recordAuditLog } from "../admin/auditLog.js";

export const ASSET_VERSION_CHANGE_ACTION = "asset.version_change";

export interface AssetUrlChange {
  field: string;
  oldUrl: string;
  newUrl: string;
}

/** Which of `fields` an update actually changed (a resent, identical value isn't a change). */
export function diffAssetUrls<F extends string>(
  before: Record<F, string>,
  input: Partial<Record<F, string>>,
  fields: readonly F[],
): AssetUrlChange[] {
  return fields
    .filter((field) => input[field] !== undefined && input[field] !== before[field])
    .map((field) => ({ field, oldUrl: before[field], newUrl: input[field] as string }));
}

/**
 * Spec 25's observability requirement: every asset-version change is logged old → new. The
 * audit entry doubles as the supersession timestamp the cleanup job's grace period (AC-5)
 * is measured from — metadata.oldUrl is what it looks up.
 */
export async function recordAssetVersionChanges(
  adminUserId: string,
  targetType: "Vehicle" | "CustomizationOption",
  targetId: string,
  changes: AssetUrlChange[],
): Promise<void> {
  for (const change of changes) {
    logger.info({ targetType, targetId, ...change }, "[assets] Asset version changed");
    await recordAuditLog({
      adminUserId,
      action: ASSET_VERSION_CHANGE_ACTION,
      targetType,
      targetId,
      metadata: { ...change },
    });
  }
}
