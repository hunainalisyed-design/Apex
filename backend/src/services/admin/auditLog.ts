import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export interface AuditLogInput {
  adminUserId: string;
  action: string; // e.g. "vehicle.create", "option.deactivate"
  targetType: string; // "Vehicle" | "CustomizationOption" | "Lead"
  targetId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an admin write (Spec 21 AC-6) — the first place in this product where an internal
 * actor's actions need traceability. Called after a mutating admin service call has already
 * succeeded, never before: a failure to write this row is logged but never rolls back the
 * business write it's recording, matching the AuditLogEntry schema comment's own documented
 * trade-off (an audit-log write failing after a real mutation already succeeded is an
 * acceptable edge case for this internal tool, not worth atomic dual-write complexity).
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLogEntry.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[admin] Failed to write audit log entry:", err);
  }
}
