import { Resend } from "resend";

const RESEND_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Apex <onboarding@resend.dev>";

let client: Resend | null = null;
function getClient(): Resend | null {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) return null;
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * Sends the password-reset email (Spec 16 AC-6/AC-7). Deliberately self-catching — never
 * throws to its caller — so POST /api/auth/forgot-password's response is identical (AC-6)
 * regardless of whether the send succeeds, fails, or no provider is configured at all.
 * Falls back to logging the link when RESEND_API_KEY is unset, the same "gracefully
 * degrade when unconfigured" treatment AI_ASSISTANT_ENABLED got in Spec 14 — no real key is
 * configured in this environment, so every path through here in practice hits this branch.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = getClient();

  if (!resend) {
    console.log(`[dev] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM_ADDRESS,
      to,
      subject: "Reset your Apex password",
      html: `<p>Someone requested a password reset for this email address.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
    });
  } catch (err) {
    console.error("[auth] Failed to send password reset email:", err instanceof Error ? err.message : err);
  }
}
