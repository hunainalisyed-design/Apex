"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/auth/FormField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { useToast } from "@/components/shell/ToastProvider";
import { validatePassword } from "@/lib/auth/validation";
import { ApiRequestError } from "@/lib/api/configurations";
import * as meApi from "@/lib/api/me";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { useAuthStore } from "@/state/authStore";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

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
  const clearSession = useAuthStore((s) => s.clearSession);
  const { show: showToast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [passwordPolicyError, setPasswordPolicyError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Spec 24, AC-5 — mirrors CaptureBuild.tsx's own blob-download pattern (createObjectURL,
  // an anchor's programmatic click, revoke after) rather than a server-driven download; the
  // export IS the JSON response body, so building the Blob client-side needs no extra fetch.
  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await meApi.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `apex-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("Your data export has started downloading.");
    } catch {
      showToast("Something went wrong while preparing your export.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteConfirm(confirmEmail: string) {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await meApi.deleteAccount(confirmEmail);
      clearSession();
      // A hard navigation, not router.push — GaragePage's own auth-guard effect also reacts
      // to `user` becoming null and would race a soft navigation to redirect to
      // /login?returnTo=/garage instead (confirmed via a failing e2e run testing this exact
      // path). A full page load to "/" wins that race outright and is the better outcome
      // anyway: "your account is gone" belongs on a clean home page, not a login screen
      // inviting you back into a garage that no longer exists.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsDeleting(false);
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

      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Your Data</h3>
        <p className="text-sm text-white/60">
          Download everything this account has saved, or delete your account permanently. See the{" "}
          <a href="/privacy-policy" className="underline underline-offset-2 hover:text-white">
            Privacy Policy
          </a>{" "}
          for what&apos;s collected and for how long.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            {isExporting ? "Preparing…" : "Download My Data"}
          </button>
          {user?.role !== "ADMIN" && (
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="rounded-full border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-300 transition hover:border-red-500 hover:text-red-200 focus-ring"
            >
              Delete My Account
            </button>
          )}
        </div>
        {user?.role === "ADMIN" && (
          <p className="text-xs text-white/40">
            Admin accounts can&apos;t be self-deleted — audit log entries must keep a durable record of who
            performed each admin action.
          </p>
        )}
      </div>

      {user && (
        <DeleteAccountDialog
          isOpen={isDeleteDialogOpen}
          isDeleting={isDeleting}
          error={deleteError}
          userEmail={user.email}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setIsDeleteDialogOpen(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
