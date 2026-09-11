"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { ApiRequestError } from "@/lib/api/configurations";
import { createLead } from "@/lib/api/leads";
import { isValidEmail } from "@/lib/auth/validation";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAuthStore } from "@/state/authStore";
import { useConfigurationStore } from "@/state/configurationStore";

export interface LeadRequestDialogProps {
  requestType: "QUOTE" | "TEST_DRIVE";
  onClose: () => void;
}

type Status = "idle" | "saving" | "submitting" | "success" | "error";

const REQUEST_LABEL: Record<"QUOTE" | "TEST_DRIVE", string> = {
  QUOTE: "Request a Quote",
  TEST_DRIVE: "Book a Test Drive",
};

/**
 * The lead-capture form (Spec 19, AC-1) — modeled on the two existing modal precedents in
 * this codebase (CaptureBuild.tsx's success modal, Spec 17's DeleteConfirmDialog.tsx):
 * role="dialog" aria-modal="true", a bg-black/70 backdrop, useFocusTrap.
 *
 * Save-if-dirty reuses configurationStore's own save()/isDirtySinceLastSave() — the exact
 * mechanism Spec 11's useCaptureBuild.ts already established — but unlike Capture, a save
 * failure here shows its own inline error rather than silently deferring to
 * SaveSharePanel's error UI: Capture's silent stand-down is justified by SaveSharePanel
 * being rendered right alongside it in the same panel, but this dialog overlays that panel,
 * so a user who just clicked "Request Quote" has no reason to look there for feedback on an
 * action they took inside a different UI surface entirely.
 */
export function LeadRequestDialog({ requestType, onClose }: LeadRequestDialogProps) {
  const user = useAuthStore((s) => s.user);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<"EMAIL" | "PHONE">("EMAIL");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Always mounted-when-rendered (LeadCaptureButtons only renders this dialog while open),
  // unlike CaptureBuild's/DeleteConfirmDialog's own isOpen-conditional internal rendering.
  useFocusTrap(dialogRef, true, onClose);

  const isBusy = status === "saving" || status === "submitting";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const nameInvalid = !trimmedName;
    const emailInvalid = !isValidEmail(email);
    setNameError(nameInvalid ? "Name is required." : null);
    setEmailError(emailInvalid ? "Enter a valid email address." : null);
    if (nameInvalid || emailInvalid) return;

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

    setStatus("submitting");
    try {
      await createLead({
        configurationPublicId: savedConfiguration.publicId,
        name: trimmedName,
        email: email.trim(),
        phone: phone.trim() || null,
        preferredContact,
        message: message.trim() || null,
        requestType,
      });
      setStatus("success");
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
        {status === "success" ? (
          <>
            <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
              {REQUEST_LABEL[requestType]}
            </h2>
            <p className="text-sm text-white/80">We&apos;ll be in touch.</p>
            <button
              type="button"
              onClick={onClose}
              className="self-start rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
              {REQUEST_LABEL[requestType]}
            </h2>

            {bannerMessage && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {bannerMessage}
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <FormField
                label="Name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                errors={nameError ? [nameError] : undefined}
              />
              <FormField
                label="Email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                errors={emailError ? [emailError] : undefined}
              />
              <FormField
                label="Phone (optional)"
                type="tel"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  Preferred contact method
                </legend>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="radio"
                      name="preferredContact"
                      value="EMAIL"
                      checked={preferredContact === "EMAIL"}
                      onChange={() => setPreferredContact("EMAIL")}
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="radio"
                      name="preferredContact"
                      value="PHONE"
                      checked={preferredContact === "PHONE"}
                      onChange={() => setPreferredContact("PHONE")}
                    />
                    Phone
                  </label>
                </div>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lead-message" className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  Message (optional)
                </label>
                <textarea
                  id="lead-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="focus-ring rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
                >
                  {status === "saving" ? "Saving build…" : status === "submitting" ? "Sending…" : "Submit"}
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
            </form>
          </>
        )}
      </div>
    </div>
  );
}
