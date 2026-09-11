"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPriceCents } from "@/lib/format/currency";
import { useReservationConfirmationStore } from "@/state/reservationConfirmationStore";

export interface ReservationConfirmationProps {
  id: string;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 5;

/**
 * The Stripe return page (Spec 20, AC-4). Since Stripe's webhook can arrive slightly after
 * the browser redirect back here, a PENDING reservation is polled a bounded number of times
 * before settling into an honest "still processing" message — deliberately NOT the spec's
 * own "check your email for confirmation" copy, since Reservation captures no email address
 * anywhere (unlike Lead) and no AC requires building one; promising an email that's never
 * sent would be worse than not mentioning one.
 */
export function ReservationConfirmation({ id }: ReservationConfirmationProps) {
  const status = useReservationConfirmationStore((s) => s.status);
  const reservation = useReservationConfirmationStore((s) => s.reservation);
  const errorMessage = useReservationConfirmationStore((s) => s.errorMessage);
  const load = useReservationConfirmationStore((s) => s.load);
  const [pollAttempts, setPollAttempts] = useState(0);

  useEffect(() => {
    void load(id);
  }, [id, load]);

  useEffect(() => {
    if (status !== "loaded" || reservation?.status !== "PENDING" || pollAttempts >= MAX_POLL_ATTEMPTS) return;

    const timeout = setTimeout(() => {
      setPollAttempts((n) => n + 1);
      void load(id);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timeout);
  }, [status, reservation?.status, pollAttempts, id, load]);

  if (status === "loading") {
    return (
      <div className="glass-panel flex w-full max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <p className="text-sm text-white/70">Loading your reservation…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="glass-panel flex w-full max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <p className="text-sm text-red-300">{errorMessage}</p>
        <button
          type="button"
          onClick={() => void load(id)}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  const r = reservation!;
  const amount = formatPriceCents(r.amountCents, r.currency);

  return (
    <div className="glass-panel flex w-full max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
      {r.status === "PAID" && (
        <>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Reservation Confirmed</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">You&apos;re all set</h1>
          <p className="text-sm text-white/70">
            Your {amount} deposit has been confirmed (test mode — no real payment was processed).
          </p>
        </>
      )}

      {r.status === "PENDING" && (
        <>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Reservation Pending</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Almost there</h1>
          <p className="text-sm text-white/70">
            {pollAttempts >= MAX_POLL_ATTEMPTS
              ? "This is taking longer than expected — refresh this page in a moment to check again."
              : "Confirming your payment — this only takes a moment…"}
          </p>
        </>
      )}

      {(r.status === "FAILED" || r.status === "REFUNDED") && (
        <>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Reservation {r.status === "FAILED" ? "Failed" : "Refunded"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {r.status === "FAILED" ? "Something went wrong" : "This reservation was refunded"}
          </h1>
          <p className="text-sm text-white/70">
            {r.status === "FAILED"
              ? "Your deposit wasn't processed. You can try reserving again from the configurator."
              : "No further action is needed."}
          </p>
        </>
      )}

      <Link
        href={`/configure/${r.vehicleSlug}?build=${r.configurationPublicId}`}
        className="mt-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
      >
        Back to Configurator
      </Link>
    </div>
  );
}
