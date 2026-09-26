import type { UserDto } from "./auth.js";
import type { LeadDto } from "./leads.js";
import type { ReservationDto } from "./reservations.js";
import type { SavedConfigurationDto } from "./configuration.js";

/** Spec 24, AC-5: everything personally identifying this product stores about one user,
 * across every spec that collects it (16, 10, 19, 20, 31) — `passwordHash` is never included
 * (UserDto already excludes it, same as every other auth response). */
export interface UserDataExportDto {
  exportedAt: string; // ISO 8601
  user: UserDto;
  configurations: SavedConfigurationDto[];
  leads: LeadDto[];
  reservations: ReservationDto[];
  /** Spec 31: the published builds this user has liked. */
  likes: Array<{ configurationPublicId: string; likedAt: string }>;
}

/** Body of DELETE /me (Spec 24, AC-6) — the account's own email, typed back as confirmation. */
export interface DeleteAccountRequest {
  confirmEmail: string;
}
