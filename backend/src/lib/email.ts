import { Resend } from "resend";

/** Extracted from services/auth/email.ts (Spec 19) — a second consumer (services/leads/)
 * needs the exact same lazy-singleton Resend client, so this is now the one shared place
 * that decides whether real email sending is configured at all. */
export const RESEND_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Apex <onboarding@resend.dev>";

let client: Resend | null = null;
export function getResendClient(): Resend | null {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) return null;
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}
