import { randomBytes } from "node:crypto";

/** How long an uploaded AR model stays downloadable — Scene Viewer fetches it within seconds
 * of the hand-off, so ten minutes is generous while keeping memory bounded. */
export const AR_MODEL_TTL_MS = 10 * 60 * 1000;

/** Largest single upload (Spec 27 Step 0: the heaviest car's GLB is ~11 MB). */
export const AR_MODEL_MAX_BYTES = 30 * 1024 * 1024;

/** Cap on everything held at once, so a burst of uploads can't exhaust the process's memory;
 * the oldest models are evicted first when a new one would exceed it. */
export const AR_STORE_MAX_TOTAL_BYTES = 200 * 1024 * 1024;

interface StoredModel {
  data: Buffer;
  expiresAt: number;
}

export interface ArModelStore {
  put(data: Buffer): { id: string; expiresAt: Date };
  get(id: string): Buffer | null;
  /** Total bytes currently held (after dropping expired entries). */
  size(): number;
}

/**
 * Short-lived, in-memory hosting for exported AR models (Spec 27, AC-3). Nothing is persisted:
 * a model is only meaningful for the few seconds it takes Scene Viewer to download it, and a
 * restart losing them costs the user one more tap. IDs are 128 random bits, so a URL can't be
 * guessed or enumerated.
 */
export function createArModelStore(options: { ttlMs?: number; maxTotalBytes?: number; now?: () => number } = {}): ArModelStore {
  const ttlMs = options.ttlMs ?? AR_MODEL_TTL_MS;
  const maxTotalBytes = options.maxTotalBytes ?? AR_STORE_MAX_TOTAL_BYTES;
  const now = options.now ?? Date.now;
  const models = new Map<string, StoredModel>(); // insertion order = oldest first
  let totalBytes = 0;

  function remove(id: string) {
    const model = models.get(id);
    if (!model) return;
    totalBytes -= model.data.length;
    models.delete(id);
  }

  function dropExpired() {
    const current = now();
    for (const [id, model] of models) if (model.expiresAt <= current) remove(id);
  }

  return {
    put(data) {
      dropExpired();
      for (const id of models.keys()) {
        if (totalBytes + data.length <= maxTotalBytes) break;
        remove(id);
      }
      const id = randomBytes(16).toString("base64url");
      const expiresAt = now() + ttlMs;
      models.set(id, { data, expiresAt });
      totalBytes += data.length;
      return { id, expiresAt: new Date(expiresAt) };
    },
    get(id) {
      const model = models.get(id);
      if (!model) return null;
      if (model.expiresAt <= now()) {
        remove(id);
        return null;
      }
      return model.data;
    },
    size() {
      dropExpired();
      return totalBytes;
    },
  };
}

export const arModelStore = createArModelStore();

/**
 * A structurally valid binary glTF 2.0 header: the "glTF" magic, version 2, and a declared
 * total length matching the bytes received (catches truncated uploads and non-GLB files).
 */
export function isGlb(data: Buffer): boolean {
  return (
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "glTF" &&
    data.readUInt32LE(4) === 2 &&
    data.readUInt32LE(8) === data.length
  );
}

/** The origin Scene Viewer downloads from: AR_PUBLIC_BASE_URL when set (needed behind a
 * proxy/CDN, where the request's own host isn't the public one), else the request's origin. */
export function resolvePublicBaseUrl(configured: string | undefined, requestOrigin: string): string {
  return (configured || requestOrigin).replace(/\/+$/, "");
}
