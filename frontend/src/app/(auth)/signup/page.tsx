"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { isValidEmail, validatePassword } from "@/lib/auth/validation";
import { useAuthStore } from "@/state/authStore";

export default function SignupPage() {
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
    if (!name.trim()) nextErrors.name = ["Name is required."];
    if (!isValidEmail(email)) nextErrors.email = ["Enter a valid email address."];
    const passwordViolation = validatePassword(password);
    if (passwordViolation) nextErrors.password = [passwordViolation];
    if (!acceptedTerms) nextErrors.acceptedTerms = ["You must accept the terms to sign up."];

    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void signup({ name: name.trim(), email, password, acceptedTerms: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">Create your account</h1>
        <p className="text-sm text-white/60">Save builds and pick up where you left off.</p>
      </div>

      {bannerMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bannerMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField
          label="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          errors={nameErrors}
        />
        <FormField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={emailErrors}
        />
        <div className="flex flex-col gap-1.5">
          <FormField
            label="Password"
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
            I accept the terms of service.
          </label>
          {termsErrors && <p className="text-xs text-red-300">{termsErrors.join(" ")}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Creating account…" : "Sign Up"}
        </button>
      </form>

      <p className="text-center text-xs text-white/50">
        Already have an account?{" "}
        <Link href="/login" className="focus-ring rounded text-white underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
