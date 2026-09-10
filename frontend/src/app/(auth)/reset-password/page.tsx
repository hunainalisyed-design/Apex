"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { validatePassword } from "@/lib/auth/validation";
import { useAuthStore } from "@/state/authStore";

function ResetPasswordForm() {
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
        <h1 className="text-xl font-bold tracking-tight text-white">Invalid reset link</h1>
        <p className="text-sm text-white/60">This link is missing its token. Request a new one.</p>
        <Link href="/forgot-password" className="focus-ring rounded text-sm text-white underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">Password updated</h1>
        <p className="text-sm text-white/60">Please log in again with your new password.</p>
        <Link href="/login" className="focus-ring rounded text-sm text-white underline">
          Log in
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
        <h1 className="text-xl font-bold tracking-tight text-white">Choose a new password</h1>
      </div>

      {bannerMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bannerMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FormField
            label="New password"
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
          {isLoading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

/** useSearchParams() requires a Suspense boundary in the App Router — this route's own
 * page-level one, since (auth)/layout.tsx wraps every sibling page and shouldn't suspend
 * the ones that don't need it. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
