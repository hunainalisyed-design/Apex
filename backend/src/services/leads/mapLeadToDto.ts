import type { Lead } from "@prisma/client";
import type { LeadDto } from "../../types/leads.js";

export type LeadWithConfiguration = Lead & {
  configuration: { publicId: string; vehicle: { slug: string } };
};

export function mapLeadToDto(lead: LeadWithConfiguration): LeadDto {
  return {
    id: lead.id,
    configurationPublicId: lead.configuration.publicId,
    vehicleSlug: lead.configuration.vehicle.slug,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    preferredContact: lead.preferredContact,
    message: lead.message,
    requestType: lead.requestType,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
  };
}
