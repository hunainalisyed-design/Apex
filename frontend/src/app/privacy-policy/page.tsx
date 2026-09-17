import type { Metadata } from "next";

const DESCRIPTION = "What APEX collects, why, and for how long — and how to export or delete your data.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: DESCRIPTION,
  openGraph: { title: "Privacy Policy | APEX", description: DESCRIPTION },
};

/**
 * Spec 24, AC-4 — plain-language description of what's collected, why, and for how long.
 * The retention periods below restate this spec's own §4 (Retention and privacy) verbatim
 * rather than inventing new numbers, so the policy and the spec can never drift apart.
 */
export default function PrivacyPolicyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 justify-center px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Legal</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
            Privacy Policy
          </h1>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">What we collect</h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-white/70">
            <li>
              <strong className="text-white/90">Account data</strong> (name, email) — if you sign up, to let you
              save builds, request a quote/test drive as a known contact, and manage a reservation.
            </li>
            <li>
              <strong className="text-white/90">Saved configurations</strong> — the vehicle and options you build,
              whether signed in or as a guest, so a shared build link shows the same thing to anyone who opens it.
            </li>
            <li>
              <strong className="text-white/90">Leads</strong> — the name, email, phone, and message you submit
              when requesting a quote or test drive.
            </li>
            <li>
              <strong className="text-white/90">Reservations</strong> — a Stripe (test-mode) deposit record tied
              to a saved configuration.
            </li>
            <li>
              <strong className="text-white/90">Analytics</strong> — only if you accept the cookie banner; never
              loaded otherwise.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Cookies</h2>
          <p className="text-sm leading-relaxed text-white/70">
            One strictly-necessary session cookie keeps you signed in and requires no consent under GDPR. No
            other cookie or analytics script loads until you accept the cookie banner; rejecting or ignoring it
            keeps everything else off.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">How long we keep it</h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-white/70">
            <li>Account data — until you delete your account.</li>
            <li>Guest (not signed in) saved configurations — 90 days after last access.</li>
            <li>Leads — 2 years.</li>
            <li>Reservations — retained as a transaction record, aligned with standard financial record-keeping.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Your data, your control</h2>
          <p className="text-sm leading-relaxed text-white/70">
            If you have an account, My Garage lets you download a full export of everything above tied to your
            account, or delete your account outright. Deleting your account removes your name, email, and
            password; any leads or reservations you made stay on record as anonymous, since they represent real
            business activity, but are no longer linked to you.
          </p>
        </section>
      </div>
    </main>
  );
}
