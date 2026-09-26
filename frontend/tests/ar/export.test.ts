import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from "three";
import { detectArPlatform } from "../../src/lib/ar/capability";
import { exportGlb, prepareArScene } from "../../src/lib/ar/exportModel";
import { buildSceneViewerIntent } from "../../src/lib/ar/launch";
import { simplifyGeometry, simplifyObject } from "../../src/lib/ar/simplify";
import { REAL_GLB_VEHICLES } from "../../src/lib/showroom/realGlbVehicles";

/** A stand-in for the showroom rig: a 'body' and 'wheel' normalized to the showroom's
 * 4.2-unit framing length (not metres), offset like the real rig's wrapper group. */
function makeShowroomCar(paint = "#b3121b") {
  const body = new Mesh(new BoxGeometry(4.2, 1.2, 1.9), new MeshStandardMaterial({ name: "Paint", color: paint }));
  body.position.y = 0.6;
  const wheel = new Mesh(new BoxGeometry(0.7, 0.7, 0.3), new MeshStandardMaterial({ name: "Tyre", color: "#111111" }));
  wheel.position.set(1.4, 0.35, 0.95);
  const rig = new Group();
  rig.add(body, wheel);
  const wrapper = new Group();
  wrapper.position.set(3, -0.3, 2); // wherever the scene put it
  wrapper.add(rig);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

/** Splits a GLB into its JSON chunk. */
function glbJson(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
}

describe("device capability detection (Spec 27, AC-1)", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
  const PIXEL = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
  const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0";
  const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

  it.each([
    ["iOS Safari with Quick Look", IPHONE, true, "ios"],
    ["Android Chrome", PIXEL, false, "android"],
    ["Android Firefox (no intent support)", ANDROID_FIREFOX, false, null],
    ["desktop Chrome", DESKTOP, false, null],
    ["an iPhone browser without Quick Look", IPHONE, false, null],
  ])("%s → %s", (_label, userAgent, supportsQuickLook, expected) => {
    expect(detectArPlatform({ userAgent, supportsQuickLook })).toBe(expected);
  });
});

describe("prepareArScene — real-world scale (AC-4)", () => {
  it("rescales the showroom's 4.2-unit framing to the car's real length in metres, grounded and centred", () => {
    const root = prepareArScene(makeShowroomCar(), 4.62);
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());

    expect(Math.max(size.x, size.z)).toBeCloseTo(4.62, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
    const center = box.getCenter(new Vector3());
    expect(center.x).toBeCloseTo(0, 5);
    expect(center.z).toBeCloseTo(0, 5);
  });

  it("leaves the live scene untouched", () => {
    const car = makeShowroomCar();
    const before = car.position.clone();
    prepareArScene(car, 4.62);
    expect(car.position.equals(before)).toBe(true);
    expect(car.scale.x).toBe(1);
  });

  it("has a real length for every real-GLB vehicle", () => {
    for (const config of Object.values(REAL_GLB_VEHICLES)) {
      expect(config.lengthMeters).toBeGreaterThan(3.5);
      expect(config.lengthMeters).toBeLessThan(6);
    }
  });
});

describe("exportGlb — Android (AC-2, AC-3)", () => {
  it("writes a binary glTF carrying the car's current paint and meshes", async () => {
    const file = await exportGlb(prepareArScene(makeShowroomCar("#1f4b8f"), 4.62));

    expect(file.mimeType).toBe("model/gltf-binary");
    expect(new TextDecoder().decode(file.bytes.subarray(0, 4))).toBe("glTF");
    const json = glbJson(file.bytes);
    const paint = json.materials.find((m: { name: string }) => m.name === "Paint");
    // glTF stores linear colour — the same linear values three.js holds for the hex.
    const expected = new Color("#1f4b8f");
    const [r, g, b] = paint.pbrMetallicRoughness.baseColorFactor;
    expect(r).toBeCloseTo(expected.r, 5);
    expect(g).toBeCloseTo(expected.g, 5);
    expect(b).toBeCloseTo(expected.b, 5);
    expect(json.meshes).toHaveLength(2);
  });
});

describe("simplifyGeometry", () => {
  it("keeps roughly the requested share of triangles and drops unused vertices", async () => {
    const { MeshoptSimplifier } = await import("meshoptimizer/simplifier");
    await MeshoptSimplifier.ready;
    const sphere = new SphereGeometry(1, 64, 48);
    const simplified = simplifyGeometry(sphere, 0.25)!;

    const before = sphere.index!.count / 3;
    const after = simplified.index!.count / 3;
    expect(after).toBeLessThanOrEqual(before * 0.26);
    expect(after).toBeGreaterThan(before * 0.1);
    expect(simplified.attributes.position.count).toBeLessThan(sphere.attributes.position.count);
    for (const name of Object.keys(sphere.attributes)) expect(simplified.attributes[name]).toBeDefined();
  });

  it("skips geometry it can't simplify safely (tiny, or split across material groups)", async () => {
    const { MeshoptSimplifier } = await import("meshoptimizer/simplifier");
    await MeshoptSimplifier.ready;
    expect(simplifyGeometry(new BoxGeometry(1, 1, 1), 0.5)).toBeNull(); // 36 indices
    const grouped = new SphereGeometry(1, 64, 48);
    grouped.addGroup(0, 300, 0);
    grouped.addGroup(300, grouped.index!.count - 300, 1);
    expect(simplifyGeometry(grouped, 0.5)).toBeNull();
  });

  it("simplifyObject swaps geometry on the export copy, never mutating the shared original", async () => {
    const shared = new SphereGeometry(1, 64, 48);
    const original = new Group().add(new Mesh(shared, new MeshStandardMaterial()));
    const copy = original.clone(true);
    await simplifyObject(copy, 0.3);
    expect((original.children[0] as Mesh).geometry).toBe(shared);
    expect((copy.children[0] as Mesh).geometry).not.toBe(shared);
    expect(shared.index!.count).toBe(64 * 48 * 6 - 64 * 6); // unchanged
  });
});

describe("Scene Viewer hand-off (AC-3, AC-4)", () => {
  it("builds an AR-only, non-resizable intent with a fallback back to the page", () => {
    const intent = buildSceneViewerIntent("https://api.example.com/api/ar/models/abc.glb", "Porsche 992 GT3 R", "https://apex.example/configure/x");
    expect(intent.startsWith("intent://arvr.google.com/scene-viewer/1.2?")).toBe(true);
    const query = new URLSearchParams(intent.slice(intent.indexOf("?") + 1, intent.indexOf("#")));
    expect(query.get("file")).toBe("https://api.example.com/api/ar/models/abc.glb");
    expect(query.get("mode")).toBe("ar_only");
    expect(query.get("resizable")).toBe("false");
    expect(query.get("title")).toBe("Porsche 992 GT3 R");
    expect(intent).toContain("package=com.google.ar.core");
    expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent("https://apex.example/configure/x")};end;`);
  });
});
