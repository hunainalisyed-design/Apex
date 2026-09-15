import { prisma } from "../../lib/prisma.js";
import type { CreateLeadRequest, LeadDto } from "../../types/leads.js";
import { sendDealerNotificationEmail, sendRequesterConfirmationEmail } from "./email.js";
import { mapLeadToDto } from "./mapLeadToDto.js";

export type CreateLeadResult = { ok: true; lead: LeadDto } | { ok: false; reason: "NOT_FOUND" };

/**
 * Creates a Lead tied to an already-saved Configuration (Spec 19 AC-2) — the caller (the
 * route) is responsible for ensuring the configuration was saved first (the frontend's
 * save-if-dirty flow, mirroring Spec 11's useCaptureBuild.ts); this function only looks it
 * up by the publicId it's given. Both notification emails are awaited but self-catching, so
 * a Resend outage never fails lead creation itself (AC-2's "user sees a confirmation" is
 * independent of email deliverability, same as Spec 16's forgot-password contract).
 */
export async function createLead(input: CreateLeadRequest, userId: string | null): Promise<CreateLeadResult> {
  const configuration = await prisma.configuration.findUnique({
    where: { publicId: input.configurationPublicId },
    include: { vehicle: true },
  });

  if (!configuration) return { ok: false, reason: "NOT_FOUND" };

  const lead = await prisma.lead.create({
    data: {
      configurationId: configuration.id,
      userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      preferredContact: input.preferredContact,
      message: input.message,
      requestType: input.requestType,
    },
    include: { configuration: { include: { vehicle: true } } },
  });

  const configurationUrl = `${process.env.FRONTEND_ORIGIN ?? "http://localhost:3000"}/configure/${configuration.vehicle.slug}?build=${configuration.publicId}`;

  await sendDealerNotificationEmail(lead, configurationUrl);
  await sendRequesterConfirmationEmail(lead);

  return { ok: true, lead: mapLeadToDto(lead) };
}
