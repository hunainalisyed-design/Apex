import { describe, expect, it } from "vitest";
import { createArModelStore, isGlb, resolvePublicBaseUrl } from "../../src/services/ar/modelStore.js";
import { makeGlb } from "./glbFixture.js";

describe("isGlb (Spec 27)", () => {
  it("accepts a binary glTF 2.0 header whose declared length matches", () => {
    expect(isGlb(makeGlb(100))).toBe(true);
  });

  it("rejects other files, other versions, and truncated uploads", () => {
    expect(isGlb(Buffer.from("PK\u0003\u0004 not a glb at all"))).toBe(false);
    const v1 = makeGlb();
    v1.writeUInt32LE(1, 4);
    expect(isGlb(v1)).toBe(false);
    expect(isGlb(makeGlb(100).subarray(0, 50))).toBe(false); // header says 112 bytes
    expect(isGlb(Buffer.alloc(4))).toBe(false);
  });
});

describe("createArModelStore", () => {
  it("returns what was stored under an unguessable id until it expires", () => {
    let now = 1_000;
    const store = createArModelStore({ ttlMs: 500, now: () => now });
    const glb = makeGlb(10);
    const { id, expiresAt } = store.put(glb);

    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/); // 128 random bits, base64url
    expect(expiresAt.getTime()).toBe(1_500);
    expect(store.get(id)).toBe(glb);

    now = 1_499;
    expect(store.get(id)).toBe(glb);
    now = 1_500;
    expect(store.get(id)).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("never issues the same id twice", () => {
    const store = createArModelStore();
    const ids = new Set(Array.from({ length: 200 }, () => store.put(makeGlb()).id));
    expect(ids.size).toBe(200);
  });

  it("evicts the oldest models first when the memory cap would be exceeded", () => {
    const store = createArModelStore({ maxTotalBytes: 300 });
    const first = store.put(makeGlb(88)); // 100 bytes
    const second = store.put(makeGlb(88));
    const third = store.put(makeGlb(88));
    const fourth = store.put(makeGlb(88)); // would be 400 → evicts `first`

    expect(store.get(first.id)).toBeNull();
    expect(store.get(second.id)).not.toBeNull();
    expect(store.get(third.id)).not.toBeNull();
    expect(store.get(fourth.id)).not.toBeNull();
    expect(store.size()).toBe(300);
  });

  it("drops expired models before counting toward the cap", () => {
    let now = 0;
    const store = createArModelStore({ ttlMs: 10, maxTotalBytes: 200, now: () => now });
    const old = store.put(makeGlb(88));
    now = 20;
    const fresh = store.put(makeGlb(88));
    expect(store.get(old.id)).toBeNull();
    expect(store.get(fresh.id)).not.toBeNull();
    expect(store.size()).toBe(100);
  });
});

describe("resolvePublicBaseUrl", () => {
  it("prefers the configured public origin (e.g. behind a proxy/CDN)", () => {
    expect(resolvePublicBaseUrl("https://api.example.com", "http://10.0.0.5:4000")).toBe("https://api.example.com");
  });

  it("falls back to the request's own origin when unset or empty", () => {
    expect(resolvePublicBaseUrl(undefined, "http://localhost:4000")).toBe("http://localhost:4000");
    expect(resolvePublicBaseUrl("", "http://localhost:4000")).toBe("http://localhost:4000");
  });

  it("ignores a trailing slash so URLs never get a double slash", () => {
    expect(resolvePublicBaseUrl("https://api.example.com/", "x")).toBe("https://api.example.com");
  });
});
