import type { UserDto } from "./auth";
import type { LeadDto } from "./leads";
import type { ReservationDto } from "./reservations";
import type { SavedConfigurationDto } from "./configuration";

/** Mirrors backend/src/types/gdpr.ts (Spec 24, AC-5). */
export interface UserDataExportDto {
  exportedAt: string;
  user: UserDto;
  configurations: SavedConfigurationDto[];
  leads: LeadDto[];
  reservations: ReservationDto[];
}
