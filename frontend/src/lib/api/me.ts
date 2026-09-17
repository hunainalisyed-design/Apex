import type { SavedConfigurationDto } from "@/types/configuration";
import type { UserDataExportDto } from "@/types/gdpr";
import type { UserDto } from "@/types/auth";
import { ApiRequestError } from "./configurations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function meFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/me/${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  }
  return json.data as T;
}

/** The signed-in caller's saved builds, newest first (Spec 17, AC-2). */
export function getMyConfigurations(): Promise<SavedConfigurationDto[]> {
  return meFetch("configurations", { method: "GET" });
}

export function updateProfile(request: { name: string }): Promise<UserDto> {
  return meFetch("profile", { method: "PUT", body: JSON.stringify(request) });
}

export function changePassword(request: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return meFetch("password", { method: "PUT", body: JSON.stringify(request) });
}

/** Spec 24, AC-5 — a raw file download, not the `{ data }` envelope every other endpoint
 * here uses (the backend's own GET /me/export doc comment explains why), so this bypasses
 * meFetch's generic unwrap rather than forcing that shape onto a download response. */
export async function exportMyData(): Promise<UserDataExportDto> {
  const res = await fetch(`${API_BASE_URL}/api/me/export`, { credentials: "include" });
  if (!res.ok) {
    const json = await res.json();
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.");
  }
  return res.json() as Promise<UserDataExportDto>;
}

/** Spec 24, AC-6. Like deleteConfiguration (Spec 17), a successful delete is a bare 204 —
 * res.json() would throw on that empty body, so 204 is checked first. */
export async function deleteAccount(confirmEmail: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/me`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmEmail }),
  });

  if (res.status === 204) return;
  const json = await res.json();
  throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
}
