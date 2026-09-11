"use client";

import { useId, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ApiRequestError } from "@/lib/api/configurations";
import { createCheckoutSession } from "@/lib/api/reservations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { useConfigurationStore } from "@/state/configurationStore";

const RESERVATIONS_ENABLED = process.env.NEXT_PUBLIC_RESERVATIONS_ENABLED !== "false";

type Status = "disclosure" | "saving" | "redirecting" | "error";

function ReserveDisclosureDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [status, setStatus] = useState<Status>("disclosure");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  useFocusTrap(dialogRef, true, onClose);

  const isBusy = status === "saving" || status === "redirecting";

  async function handleContinue() {
    setBannerMessage(null);

    const configState = useConfigurationStore.getState();
    if (configState.isDirtySinceLastSave()) {
      setStatus("saving");
      try {
        await configState.save();
      } catch (err) {
        const code = err instanceof ApiRequestError ? err.code : undefined;
        setBannerMessage(getErrorMessage(code));
        setStatus("error");
        return;
      }
    }

    const savedConfiguration = useConfigurationStore.getState().savedConfiguration;
    if (!savedConfiguration) {
      setBannerMessage(getErrorMessage(undefined));
      setStatus("error");
      return;
    }

    setStatus("redirecting");
    try {
      const { checkoutUrl } = await createCheckoutSession({
        configurationPublicId: savedConfiguration.publicId,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : undefined;
      setBannerMessage(getErrorMessage(code));
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex w-full max-w-md flex-col gap-4 rounded-2xl p-6"
      >
        <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
          Reserve with Deposit
        </h2>

        {/* AC-1: an unmissable disclosure that this is a test-mode demo, shown before
            anything else happens — not a fine-print footnote. */}
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Test Mode — No Real Payment</p>
          <p className="mt-1 text-sm text-white/80">
            This is a portfolio demo using Stripe&apos;s test mode. No real payment will be processed and no real
            money will move under any circumstance.
          </p>
        </div>

        <p className="text-sm text-white/70">A €500 deposit secures this exact configuration.</p>

        {bannerMessage && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {bannerMessage}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={isBusy}
            className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            {status === "saving"
              ? "Saving build…"
              : status === "redirecting"
                ? "Redirecting to secure checkout…"
                : "Continue to Stripe Checkout (Test Mode)"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * "Reserve with Deposit" (Spec 20, AC-1/AC-2) — gated by NEXT_PUBLIC_RESERVATIONS_ENABLED,
 * mirroring CarAIAssistant.tsx's exact NEXT_PUBLIC_AI_ASSISTANT_ENABLED pattern (two
 * independently-set env vars kept in sync manually, same accepted tradeoff as that spec).
 * Clicking the button opens the disclosure dialog first — nothing is saved or charged
 * before the user has seen and acted on it. Confirming reuses the exact save-if-dirty
 * pattern LeadRequestDialog.tsx established (Spec 19): if dirty, save first with its own
 * inline error on failure, then creates the checkout session and does a real browser
 * navigation to Stripe's hosted domain (window.location.href, not a client-side route
 * change).
 */
export function ReserveDepositButton() {
  const [isOpen, setIsOpen] = useState(false);

  if (!RESERVATIONS_ENABLED) return null;

  return (
    <div className="glass-panel flex rounded-2xl p-3">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
      >
        Reserve with Deposit
      </button>

      {isOpen && <ReserveDisclosureDialog onClose={() => setIsOpen(false)} />}
    </div>
  );
}
