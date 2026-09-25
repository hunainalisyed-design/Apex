"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { isValidEmail } from "@/lib/auth/validation";
import { useAuthStore } from "@/state/authStore";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const isLoading = useAuthStore((s) => s.isLoading);
  const errorCode = useAuthStore((s) => s.errorCode);

  const [email, setEmail] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  // Set once the request succeeds — the response is byte-identical whether the account
  // exists or not (AC-6), so this same confirmation always shows regardless.
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);

  const bannerMessage = errorCode ? getErrorMessage(errorCode) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setClientError(t("invalidEmail"));
      return;
    }
    setClientError(null);
    const ok = await forgotPassword(email);
    if (ok) setSubmittedSuccessfully(true);
  }

  if (submittedSuccessfully) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">{t("forgot.sentTitle")}</h1>
        <p className="text-sm text-white/60">
          {t("forgot.sentBody")}
        </p>
        <Link href="/login" className="focus-ring rounded text-sm text-white underline">
          {t("backToLogIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">{t("forgot.title")}</h1>
        <p className="text-sm text-white/60">{t("forgot.subtitle")}</p>
      </div>

      {bannerMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bannerMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={clientError ? [clientError] : undefined}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? t("forgot.submitting") : t("forgot.submit")}
        </button>
      </form>

      <p className="text-center text-xs text-white/50">
        <Link href="/login" className="focus-ring rounded text-white underline">
          {t("backToLogIn")}
        </Link>
      </p>
    </div>
  );
}
