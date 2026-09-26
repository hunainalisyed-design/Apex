import { createHash } from "node:crypto";

/**
 * Content-addressed asset URLs (Spec 25, AC-1). A versioned asset's filename carries a short
 * hash of its own bytes — `apex-gt-showroom.a1b2c3d4.glb` — so the URL itself changes
 * whenever the content does. That is what makes AC-3's year-long `immutable` caching safe,
 * and what lets an admin "replace" a model (AC-2) without ever overwriting the file an older
 * URL still points at.
 */

export const HASH_LENGTH = 8;

/** Extensions this policy governs: GLB/GLTF models, HDR environment maps (Spec 28), MP3 sound
 * cues (Spec 29) and the catalog's image formats. */
export const ASSET_EXTENSIONS = ["glb", "gltf", "hdr", "jpg", "jpeg", "png", "webp", "avif", "mp3"] as const;

const EXTENSION_GROUP = ASSET_EXTENSIONS.join("|");
const ASSET_EXTENSION_PATTERN = new RegExp(`\\.(?:${EXTENSION_GROUP})$`, "i");
// Deliberately case-sensitive (lowercase hash and extension): it must agree exactly with the
// `immutable` Cache-Control matcher in frontend/next.config.ts, or a URL could pass validation
// here yet silently miss AC-3's caching. computeContentHash always emits lowercase.
const VERSIONED_FILENAME_PATTERN = new RegExp(`\\.[0-9a-f]{${HASH_LENGTH}}\\.(?:${EXTENSION_GROUP})$`);

/** First HASH_LENGTH hex chars of the content's sha256 — deterministic per content. */
export function computeContentHash(content: Buffer | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex").slice(0, HASH_LENGTH);
}

/** The path portion of a URL or root-relative path, without any query string or fragment,
 * so `?v=2`/`#x` suffixes can't hide (or fake) the hash segment. */
function pathOf(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

/** `porsche-992-gt3-r.glb` + `a1b2c3d4` → `porsche-992-gt3-r.a1b2c3d4.glb`. An already-
 * versioned name has its old hash replaced rather than stacked (`name.old.new.glb`). */
export function toVersionedFilename(filename: string, hash: string): string {
  const unversioned = VERSIONED_FILENAME_PATTERN.test(filename)
    ? filename.replace(new RegExp(`\\.[0-9a-f]{${HASH_LENGTH}}(\\.[^.]+)$`, "i"), "$1")
    : filename;
  const dot = unversioned.lastIndexOf(".");
  if (dot <= 0) throw new Error(`Cannot version "${filename}": it has no file extension.`);
  return `${unversioned.slice(0, dot)}.${hash.toLowerCase()}${unversioned.slice(dot)}`;
}

/** True when the URL points at a file with one of ASSET_EXTENSIONS. */
export function isAssetFileUrl(url: string): boolean {
  return ASSET_EXTENSION_PATTERN.test(pathOf(url));
}

/** True when the URL's filename carries the `.<8 hex>.<ext>` version segment. */
export function isVersionedAssetUrl(url: string): boolean {
  return VERSIONED_FILENAME_PATTERN.test(pathOf(url));
}

/** Vehicle columns that hold asset URLs and are therefore always subject to this policy. */
export const VEHICLE_ASSET_FIELDS = ["heroModelUrl", "showroomModelUrl", "thumbnailUrl", "fallbackImageUrl"] as const;
export type VehicleAssetField = (typeof VEHICLE_ASSET_FIELDS)[number];

export const UNVERSIONED_ASSET_MESSAGE =
  "must be a versioned asset URL (e.g. /assets/models/name.a1b2c3d4.glb) — publish the file with `npm run assets:version` and use the URL it prints.";

/**
 * Field-level errors for vehicle asset URLs an admin is *setting*. `current` is the row as it
 * stands (null on create): a value identical to what's already stored is accepted as-is, so
 * editing a vehicle's name doesn't fail on a pre-policy placeholder URL the form resends
 * unchanged — only a genuinely new URL has to be versioned.
 */
export function validateVehicleAssetUrls(
  input: Partial<Record<VehicleAssetField, string>>,
  current: Record<VehicleAssetField, string> | null,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const field of VEHICLE_ASSET_FIELDS) {
    const value = input[field];
    if (value === undefined || value === current?.[field]) continue;
    if (!isVersionedAssetUrl(value)) errors[field] = [`${field} ${UNVERSIONED_ASSET_MESSAGE}`];
  }
  return errors;
}

/**
 * `assetRef` is usually a key the 3D layer interprets (`paint-obsidian-black`,
 * `wheel-sport-20`), not a URL — the policy applies only when an admin sets it to an actual
 * asset file, and, like vehicle URLs, only when it's changing.
 */
export function validateAssetRef(value: string | undefined, current: string | null): Record<string, string[]> {
  if (value === undefined || value === current || !isAssetFileUrl(value) || isVersionedAssetUrl(value)) return {};
  return { assetRef: [`assetRef ${UNVERSIONED_ASSET_MESSAGE}`] };
}
