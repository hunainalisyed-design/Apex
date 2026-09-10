"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { useAuthStore } from "@/state/authStore";

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const errorCode = useAuthStore((s) => s.errorCode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // INVALID_CREDENTIALS and TOO_MANY_ATTEMPTS are both deliberately generic, form-level
  // errors (Spec 16 §5) — never attributed to email or password specifically, so no
  // enumeration signal leaks through which field is shown as wrong.
  const bannerMessage = errorCode ? getErrorMessage(errorCode) : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!email.trim() || !password) return;
    void login({ email, password });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-white">Log in</h1>
        <p className="text-sm text-white/60">Welcome back.</p>
      </div>

      {bannerMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bannerMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={submitted && !email.trim() ? ["Email is required."] : undefined}
        />
        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errors={submitted && !password ? ["Password is required."] : undefined}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Logging in…" : "Log In"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 text-xs text-white/50">
        <Link href="/forgot-password" className="focus-ring rounded text-white underline">
          Forgot your password?
        </Link>
        <p>
          Need an account?{" "}
          <Link href="/signup" className="focus-ring rounded text-white underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
