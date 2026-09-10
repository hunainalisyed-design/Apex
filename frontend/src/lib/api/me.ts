import type { SavedConfigurationDto } from "@/types/configuration";
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
