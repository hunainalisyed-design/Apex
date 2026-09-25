"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { validatePassword } from "@/lib/auth/validation";
import { useAuthStore } from "@/state/authStore";

/** No page-local Suspense boundary needed here — (auth)/layout.tsx now provides one
 * (Spec 17, so it could also honor a ?returnTo= param), and a descendant's
 * useSearchParams() call suspends up to the nearest ancestor boundary regardless of how
 * many component layers sit in between. */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token");
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const isLoading = useAuthStore((s) => s.isLoading);
  const details = useAuthStore((s) => s.details);
  const errorCode = useAuthStore((s) => s.errorCode);

  const [newPassword, setNewPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const passwordErrors = details?.newPassword ?? (clientError ? [clientError] : undefined);
  const bannerMessage = errorCode && !details ? getErrorMessage(errorCode) : null;

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">{t("reset.invalidTitle")}</h1>
        <p className="text-sm text-white/60">{t("reset.invalidBody")}</p>
        <Link href="/forgot-password" className="focus-ring rounded text-sm text-white underline">
          {t("reset.requestNew")}
        </Link>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">{t("reset.successTitle")}</h1>
        <p className="text-sm text-white/60">{t("reset.successBody")}</p>
        <Link href="/login" className="focus-ring rounded text-sm text-white underline">
          {t("logInLink")}
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const violation = validatePassword(newPassword);
    if (violation) {
      setClientError(violation);
      return;
    }
    setClientError(null);
    const ok = await resetPassword(token!, newPassword);
    if (ok) setSucceeded(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">{t("reset.title")}</h1>
      </div>

      {bannerMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bannerMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FormField
            label={t("reset.newPassword")}
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            errors={passwordErrors}
          />
          <PasswordStrengthIndicator password={newPassword} />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? t("reset.submitting") : t("reset.submit")}
        </button>
      </form>
    </div>
  );
}

