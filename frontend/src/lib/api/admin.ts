import type {
  CreateOptionRequest,
  CreateVehicleRequest,
  OptionAdminDto,
  UpdateLeadStatusRequest,
  UpdateOptionRequest,
  UpdateVehicleRequest,
  VehicleAdminDto,
} from "@/types/admin";
import type { LeadDto } from "@/types/leads";
import type { ReservationDto } from "@/types/reservations";
import { ApiRequestError } from "./configurations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Every admin call needs credentials: "include" (Spec 21 builds on Spec 16's session
 * cookie) — same reasoning as lib/api/auth.ts's authFetch. A non-admin/signed-out caller
 * gets a generic 404 here, same as hitting any unknown route (Spec 21 AC-1). */
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/admin/${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  }
  return json.data as T;
}

export function listVehicles(): Promise<VehicleAdminDto[]> {
  return adminFetch("vehicles", { method: "GET" });
}

export function createVehicle(request: CreateVehicleRequest): Promise<VehicleAdminDto> {
  return adminFetch("vehicles", { method: "POST", body: JSON.stringify(request) });
}

export function updateVehicle(id: string, request: UpdateVehicleRequest): Promise<VehicleAdminDto> {
  return adminFetch(`vehicles/${id}`, { method: "PUT", body: JSON.stringify(request) });
}

export function listOptions(vehicleId: string): Promise<OptionAdminDto[]> {
  return adminFetch(`vehicles/${vehicleId}/options`, { method: "GET" });
}

export function createOption(vehicleId: string, request: CreateOptionRequest): Promise<OptionAdminDto> {
  return adminFetch(`vehicles/${vehicleId}/options`, { method: "POST", body: JSON.stringify(request) });
}

export function updateOption(id: string, request: UpdateOptionRequest): Promise<OptionAdminDto> {
  return adminFetch(`options/${id}`, { method: "PUT", body: JSON.stringify(request) });
}

export function deactivateOption(id: string): Promise<void> {
  return adminFetch(`options/${id}`, { method: "DELETE" });
}

export function listLeads(status?: "NEW" | "CONTACTED" | "CLOSED"): Promise<LeadDto[]> {
  return adminFetch(`leads${status ? `?status=${status}` : ""}`, { method: "GET" });
}

export function updateLeadStatus(id: string, request: UpdateLeadStatusRequest): Promise<LeadDto> {
  return adminFetch(`leads/${id}`, { method: "PUT", body: JSON.stringify(request) });
}

export function listReservations(): Promise<ReservationDto[]> {
  return adminFetch("reservations", { method: "GET" });
}
