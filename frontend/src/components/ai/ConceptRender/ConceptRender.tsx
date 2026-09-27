"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ApiRequestError } from "@/lib/api/configurations";
import { requestConceptRender } from "@/lib/api/conceptRender";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";

type RenderState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; imageUrl: string; isPlaceholder: boolean }
  | { status: "error"; message: string };

export interface ConceptRenderProps {
  vehicle: VehicleDetailDto;
}

/**
 * "Imagine the Ultimate Version" (Spec 35): an AI concept image of a more extreme take on the
 * current build, shown in its own dialog. It is inspiration, never a configuration — so the
 * dialog is visually unlike the 3D showroom and CarAI's recommendation cards, it carries the
 * "AI Concept — Not a Real Configuration" label in every state (on the image itself too, so a
 * screenshot keeps it), and there is deliberately no Apply action anywhere (AC-2/AC-3).
 */
export function ConceptRender({ vehicle }: ConceptRenderProps) {
  const t = useTranslations("conceptRender");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RenderState>({ status: "idle" });
  const request = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Leaving the page cancels a generation still in progress.
  useEffect(() => () => request.current?.abort(), []);

  async function generate() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: "loading" });
    const { singleSelections, multiSelections, customPaintHex } = useConfigurationStore.getState();
    try {
      const result = await requestConceptRender(
        { vehicleSlug: vehicle.slug, singleSelections, multiSelections, customPaintHex },
        controller.signal,
      );
      if (request.current !== controller) return;
      setState({ status: "success", imageUrl: result.imageUrl, isPlaceholder: result.isPlaceholder });
    } catch (err) {
      if (request.current !== controller || controller.signal.aborted) return;
      setState({ status: "error", message: getErrorMessage(err instanceof ApiRequestError ? err.code : "IMAGE_PROVIDER_ERROR") });
    }
  }

  function openDialog() {
    setOpen(true);
    void generate();
  }

  function close() {
    request.current?.abort();
    request.current = null;
    setOpen(false);
    setState({ status: "idle" });
    // However it closes (Close, the backdrop, Escape), keyboard focus goes back where it was.
    buttonRef.current?.focus();
  }

  useFocusTrap(dialogRef, open, close, { returnFocusTo: buttonRef });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openDialog}
        className="glass-panel flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white focus-ring"
      >
        <span aria-hidden="true" className="text-violet-300">
          ✦
        </span>
        {t("button")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={close}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-3xl flex-col gap-4 rounded-2xl border-2 border-dashed border-violet-400/60 bg-[#120f1c] p-5"
            data-testid="concept-render-dialog"
          >
            <div className="flex flex-col gap-1">
              <p className="w-fit rounded-full bg-violet-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200" data-testid="concept-label">
                {t("label")}
              </p>
              <h2 id={titleId} className="text-lg font-semibold text-white">
                {t("dialogTitle")}
              </h2>
            </div>
            <p id={descriptionId} className="text-xs text-white/60">
              {t("explainer")}
            </p>

            <div className="relative aspect-[7/4] w-full overflow-hidden rounded-xl bg-black/40">
              {state.status === "loading" && (
                <div role="status" className="flex h-full flex-col items-center justify-center gap-4 text-sm text-violet-100">
                  <span aria-hidden="true" className="h-10 w-10 rounded-full border-2 border-violet-300/30 border-t-violet-300 motion-safe:animate-spin" />
                  {t("loading")}
                </div>
              )}

              {state.status === "success" && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, not an optimizable asset */}
                  <img src={state.imageUrl} alt={t("imageAlt", { vehicle: vehicle.name })} className="h-full w-full object-cover" />
                  {/* On the image itself, so it can't be cropped away from the picture. */}
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200" aria-hidden="true">
                    {t("badge")}
                  </span>
                </>
              )}

              {state.status === "error" && (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p role="alert" className="text-sm text-red-200">
                    {state.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => void generate()}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
                  >
                    {t("retry")}
                  </button>
                </div>
              )}
            </div>

            {state.status === "success" && state.isPlaceholder && <p className="text-xs text-amber-200">{t("placeholderNote")}</p>}

            <button
              type="button"
              onClick={close}
              className="self-end rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
