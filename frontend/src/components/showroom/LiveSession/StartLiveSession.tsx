"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiRequestError } from "@/lib/api/configurations";
import { createLiveSession } from "@/lib/api/liveSessions";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import { LIVE_NAME_MAX_LENGTH, markJoined, readLiveName, writeLiveName } from "./liveName";

export interface StartLiveSessionProps {
  vehicle: VehicleDetailDto;
}

/**
 * "Start Live Session" (Spec 33, AC-1): turns the current build into a live session and moves
 * this tab onto its link, which is then shared with a friend. No account needed (AC-8).
 */
export function StartLiveSession({ vehicle }: StartLiveSessionProps) {
  const t = useTranslations("live");
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setName(readLiveName());
    setError(null);
    setOpen(true);
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setStarting(true);
    setError(null);
    const { singleSelections, multiSelections, customPaintHex, environmentId } = useConfigurationStore.getState();
    try {
      const session = await createLiveSession({
        vehicleSlug: vehicle.slug,
        singleSelections,
        multiSelections,
        customPaintHex,
        environmentId,
      });
      writeLiveName(name.trim());
      markJoined(session.sessionId);
      // A full load: the live page is server-rendered around the session it just looked up.
      window.location.assign(`/configure/${session.vehicleSlug}/live/${session.sessionId}`);
    } catch (err) {
      // The server says why (turned off, too many sessions, rate-limited); a network failure doesn't.
      setError(err instanceof ApiRequestError ? getErrorMessage(err.code) : t("startFailed"));
      setStarting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="glass-panel flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white focus-ring"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
        {t("start")}
      </button>
    );
  }

  return (
    <form onSubmit={start} className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-4" aria-label={t("startTitle")}>
      <p className="text-sm font-semibold text-white">{t("startTitle")}</p>
      <p className="text-xs text-white/60">{t("startBody")}</p>
      <label htmlFor={nameId} className="text-xs text-white/70">
        {t("yourName")}
      </label>
      <input
        id={nameId}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={LIVE_NAME_MAX_LENGTH}
        placeholder={t("namePlaceholder")}
        autoComplete="nickname"
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus-ring"
      />
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={starting}
          className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
        >
          {starting ? t("starting") : t("start")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white focus-ring"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
