"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { useToast } from "@/components/shell/ToastProvider";
import { validatePassword } from "@/lib/auth/validation";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { useAuthStore } from "@/state/authStore";

/**
 * Profile name + change-password forms (Spec 17, AC-9) — two independent forms sharing
 * authStore's isLoading/details/errorCode fields (the same fields signup/login/reset
 * already share, since only one auth action is ever in flight at a time). Field-specific
 * `details` keys never collide between the two forms ("name" vs. "currentPassword"/
 * "newPassword"), so inline errors always land under the right field regardless of which
 * form last submitted; the rare non-field-specific failure (e.g. a dropped session
 * mid-edit) surfaces as one shared banner rather than being duplicated under both forms.
 */
export function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const details = useAuthStore((s) => s.details);
  const errorCode = useAuthStore((s) => s.errorCode);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const { show: showToast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [passwordPolicyError, setPasswordPolicyError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const bannerMessage = errorCode && !details ? getErrorMessage(errorCode) : null;

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setNameError(null);
    const ok = await updateProfile(name.trim());
    if (ok) showToast("Profile updated");
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();

    const violation = validatePassword(newPassword);
    setPasswordPolicyError(violation);
    const mismatch = newPassword !== confirmPassword;
    setConfirmMismatch(mismatch);
    if (violation || mismatch) return;

    const ok = await changePassword(currentPassword, newPassword);
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setConfirmMismatch(false);
      setPasswordPolicyError(null);
      showToast("Password updated — other devices have been signed out.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Profile</h2>

      {bannerMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bannerMessage}
        </p>
      )}

      <form onSubmit={handleNameSubmit} noValidate className="glass-panel flex flex-col gap-4 rounded-2xl p-4">
        <FormField
          label="Name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          errors={details?.name ?? (nameError ? [nameError] : undefined)}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="self-start rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
        >
          Save Name
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} noValidate className="glass-panel flex flex-col gap-4 rounded-2xl p-4">
        <FormField
          label="Current Password"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          errors={details?.currentPassword}
        />
        <div className="flex flex-col gap-1.5">
          <FormField
            label="New Password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            errors={details?.newPassword ?? (passwordPolicyError ? [passwordPolicyError] : undefined)}
          />
          <PasswordStrengthIndicator password={newPassword} />
        </div>
        <FormField
          label="Confirm New Password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          errors={confirmMismatch ? ["Passwords don't match."] : undefined}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="self-start rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
        >
          Change Password
        </button>
      </form>
    </div>
  );
}
