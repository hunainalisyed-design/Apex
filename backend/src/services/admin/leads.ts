import { prisma } from "../../lib/prisma.js";
import { mapLeadToDto } from "../leads/mapLeadToDto.js";
import { parsePagination } from "./pagination.js";
import type { LeadDto } from "../../types/leads.js";
import type { PaginationQuery } from "../../types/admin.js";

export interface ListLeadsFilter {
  status?: "NEW" | "CONTACTED" | "CLOSED";
}

export async function listLeads(filter: ListLeadsFilter, pagination: PaginationQuery): Promise<LeadDto[]> {
  const { skip, take } = parsePagination(pagination);
  const leads = await prisma.lead.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    include: { configuration: { include: { vehicle: true } } },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
  return leads.map(mapLeadToDto);
}

export type UpdateLeadStatusResult = { ok: true; lead: LeadDto } | { ok: false; reason: "NOT_FOUND" };

/** AC-4: admin sets CONTACTED/CLOSED only — NEW is system-set on creation and never
 * admin-settable (enforced by the route's own validation, not here). */
export async function updateLeadStatus(id: string, status: "CONTACTED" | "CLOSED"): Promise<UpdateLeadStatusResult> {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const lead = await prisma.lead.update({
    where: { id },
    data: { status },
    include: { configuration: { include: { vehicle: true } } },
  });
  return { ok: true, lead: mapLeadToDto(lead) };
}
