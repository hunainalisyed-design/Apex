"use client";

import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CATEGORY_LABELS } from "@/components/configurator/categoryLabels";
import { useToast } from "@/components/shell/ToastProvider";
import { useLiveSessionStore, type LiveRemoteChange } from "@/state/liveSessionStore";
import type { VehicleDetailDto } from "@/types/catalog";
import { hasJoined, LIVE_NAME_MAX_LENGTH, markJoined, readLiveName, writeLiveName } from "./liveName";
import { StartLiveSession } from "./StartLiveSession";

export interface LiveSessionPanelProps {
  vehicle: VehicleDetailDto;
  sessionId: string;
}

const noopSubscribe = () => () => {};

/**
 * The live-session controls on /configure/[slug]/live/[sessionId] (Spec 33): a join card for
 * someone arriving by link, then who's here (names + colors, AC-2), the connection state
 * ("Joining session…", "Reconnecting…", §5), the invite link, and why a session ended. Others'
 * changes are announced as toasts ("Alex changed the Wheels", Risk #3), and a partner's save
 * is shown with a link to it (AC-5 — the session carries on).
 */
export function LiveSessionPanel({ vehicle, sessionId }: LiveSessionPanelProps) {
  const t = useTranslations("live");
  const { show: showToast } = useToast();
  const nameId = useId();
  const status = useLiveSessionStore((s) => s.status);
  const endReason = useLiveSessionStore((s) => s.endReason);
  const participants = useLiveSessionStore((s) => s.participants);
  const participantId = useLiveSessionStore((s) => s.participantId);
  const lastRemoteChange = useLiveSessionStore((s) => s.lastRemoteChange);
  const lastSaved = useLiveSessionStore((s) => s.lastSaved);
  const connect = useLiveSessionStore((s) => s.connect);
  const leave = useLiveSessionStore((s) => s.leave);
  // Whoever started or already joined this session in this tab rejoins without the join card.
  const joinedBefore = useSyncExternalStore(noopSubscribe, () => hasJoined(sessionId), () => false);
  const [name, setName] = useState("");
  const [left, setLeft] = useState(false);

  useEffect(() => {
    if (joinedBefore) connect(sessionId, readLiveName() || t("namePlaceholder"));
  }, [joinedBefore, sessionId, connect, t]);

  // Leaving the page leaves the session.
  useEffect(() => () => useLiveSessionStore.getState().leave(), []);

  useEffect(() => {
    if (lastRemoteChange) showToast(describeChange(lastRemoteChange, t));
  }, [lastRemoteChange, showToast, t]);

  function join(event: React.FormEvent) {
    event.preventDefault();
    const displayName = name.trim() || t("namePlaceholder");
    writeLiveName(name.trim());
    markJoined(sessionId);
    setLeft(false);
    connect(sessionId, displayName);
  }

  function rejoin() {
    setLeft(false);
    connect(sessionId, readLiveName() || t("namePlaceholder"));
  }

  function handleLeave() {
    leave();
    setLeft(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(t("linkCopied"));
    } catch {
      showToast(t("linkCopyFailed"), "assertive");
    }
  }

  const buttonClass =
    "rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring";

  if (left) {
    return (
      <section className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-4" aria-label={t("label")}>
        <p className="text-sm text-white/80">{t("ended.left")}</p>
        <button type="button" onClick={rejoin} className={buttonClass}>
          {t("rejoin")}
        </button>
      </section>
    );
  }

  if (status === "idle" && !joinedBefore) {
    return (
      <form onSubmit={join} className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-4" aria-label={t("joinTitle")}>
        <p className="text-sm font-semibold text-white">{t("joinTitle")}</p>
        <p className="text-xs text-white/60">{t("joinBody")}</p>
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
        <button
          type="submit"
          className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
        >
          {t("join")}
        </button>
      </form>
    );
  }

  if (status === "ended") {
    return (
      <section className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-4" aria-label={t("label")}>
        <p role="alert" className="text-sm text-white/80">
          {t(`ended.${endReason ?? "failed"}`)}
        </p>
        <p className="text-xs text-white/60">{t("endedHint")}</p>
        {endReason !== "disabled" && <StartLiveSession vehicle={vehicle} />}
      </section>
    );
  }

  return (
    <section className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-4" aria-label={t("label")}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-400" : "bg-amber-300 motion-safe:animate-pulse"}`} />
          {t("label")}
        </p>
        <p role="status" className="text-xs text-white/60" data-testid="live-status">
          {status === "connecting" ? t("joining") : status === "reconnecting" ? t("reconnecting") : ""}
        </p>
      </div>

      {participants.length > 0 && (
        <div>
          <p className="sr-only">{t("participants")}</p>
          <ul className="flex flex-wrap gap-2" data-testid="live-participants">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/85"
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: participant.color }} />
                {participant.displayName}
                {participant.id === participantId && <span className="text-white/50">{t("you")}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastSaved && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/80" data-testid="live-saved">
          {t("saved", { name: lastSaved.displayName })}
          <Link href={`/configure/${vehicle.slug}?build=${lastSaved.publicId}`} className="font-semibold text-white underline-offset-4 hover:underline focus-ring">
            {t("openSaved")}
          </Link>
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={copyLink} className={`${buttonClass} flex-1`}>
          {t("copyLink")}
        </button>
        <button type="button" onClick={handleLeave} className={buttonClass}>
          {t("leave")}
        </button>
      </div>
    </section>
  );
}

function describeChange({ displayName: name, change }: LiveRemoteChange, t: ReturnType<typeof useTranslations<"live">>): string {
  switch (change.kind) {
    case "select":
    case "toggle":
      return t("changedCategory", { name, category: CATEGORY_LABELS[change.category] });
    case "customPaint":
      return t("changedCustomPaint", { name });
    case "environment":
      return t("changedScene", { name });
  }
}
