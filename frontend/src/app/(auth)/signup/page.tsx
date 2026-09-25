"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { isValidEmail, validatePassword } from "@/lib/auth/validation";
import { useAuthStore } from "@/state/authStore";

export default function SignupPage() {
  const t = useTranslations("auth");
  const signup = useAuthStore((s) => s.signup);
  const isLoading = useAuthStore((s) => s.isLoading);
  const details = useAuthStore((s) => s.details);
  const errorCode = useAuthStore((s) => s.errorCode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({});

  const nameErrors = details?.name ?? clientErrors.name;
  const emailErrors = details?.email ?? clientErrors.email;
  const passwordErrors = details?.password ?? clientErrors.password;
  const termsErrors = clientErrors.acceptedTerms;
  // A form-level banner only for errors without a field to attach to (Spec 16's
  // ApiError.details resolution — EMAIL_ALREADY_REGISTERED is field-specific, so it never
  // reaches here).
  const bannerMessage = errorCode && !details ? getErrorMessage(errorCode) : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors: Record<string, string[]> = {};
    if (!name.trim()) nextErrors.name = [t("nameRequired")];
    if (!isValidEmail(email)) nextErrors.email = [t("invalidEmail")];
    const passwordViolation = validatePassword(password);
    if (passwordViolation) nextErrors.password = [passwordViolation];
    if (!acceptedTerms) nextErrors.acceptedTerms = [t("signup.termsRequired")];

    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void signup({ name: name.trim(), email, password, acceptedTerms: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">{t("signup.title")}</h1>
        <p className="text-sm text-white/60">{t("signup.subtitle")}</p>
      </div>

      {bannerMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bannerMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField
          label={t("name")}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          errors={nameErrors}
        />
        <FormField
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={emailErrors}
        />
        <div className="flex flex-col gap-1.5">
          <FormField
            label={t("password")}
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            errors={passwordErrors}
          />
          <PasswordStrengthIndicator password={password} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="focus-ring mt-0.5"
            />
            {t("signup.acceptTerms")}
          </label>
          {termsErrors && <p className="text-xs text-red-300">{termsErrors.join(" ")}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? t("signup.submitting") : t("signup.submit")}
        </button>
      </form>

      <p className="text-center text-xs text-white/50">
        {t.rich("signup.haveAccount", {
          link: (chunks) => (
            <Link href="/login" className="focus-ring rounded text-white underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
