import type { Lead } from "@prisma/client";
import { getResendClient, RESEND_FROM_ADDRESS } from "../../lib/email.js";

const DEALER_INBOX_EMAIL = process.env.DEALER_INBOX_EMAIL ?? "dealer@apex.example";

const REQUEST_LABEL: Record<Lead["requestType"], string> = {
  QUOTE: "quote",
  TEST_DRIVE: "test drive",
};

/**
 * Notifies the dealer inbox of a new lead (Spec 19 AC-3). Self-catching — never throws —
 * matching sendPasswordResetEmail's contract (Spec 16): a Resend outage must never fail
 * lead creation itself, only the notification. Falls back to a console log when
 * RESEND_API_KEY is unset, same as every other email-sending spec in this project.
 */
export async function sendDealerNotificationEmail(lead: Lead, configurationUrl: string): Promise<void> {
  const resend = getResendClient();
  const label = REQUEST_LABEL[lead.requestType];
  const contactLine = `${lead.email}${lead.phone ? ` / ${lead.phone}` : ""} (prefers ${lead.preferredContact.toLowerCase()})`;

  if (!resend) {
    console.log(
      `[dev] Dealer notification: new ${label} request from ${lead.name} <${contactLine}>. Build: ${configurationUrl}`,
    );
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM_ADDRESS,
      to: DEALER_INBOX_EMAIL,
      subject: `New ${label} request from ${lead.name}`,
      html: `<p><strong>${lead.name}</strong> requested a ${label}.</p><p>Contact: ${contactLine}</p>${
        lead.message ? `<p>Message: ${lead.message}</p>` : ""
      }<p><a href="${configurationUrl}">View the exact configuration</a></p>`,
    });
  } catch (err) {
    console.error("[leads] Failed to send dealer notification email:", err instanceof Error ? err.message : err);
  }
}

/** Confirms receipt to the requester (Spec 19 AC-3). Same self-catching contract. */
export async function sendRequesterConfirmationEmail(lead: Lead): Promise<void> {
  const resend = getResendClient();
  const label = REQUEST_LABEL[lead.requestType];

  if (!resend) {
    console.log(`[dev] Confirmation email for ${lead.email}: we've received your ${label} request.`);
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM_ADDRESS,
      to: lead.email,
      subject: "We've received your request",
      html: `<p>Hi ${lead.name},</p><p>Thanks for your ${label} request — we'll be in touch shortly.</p>`,
    });
  } catch (err) {
    console.error("[leads] Failed to send requester confirmation email:", err instanceof Error ? err.message : err);
  }
}
