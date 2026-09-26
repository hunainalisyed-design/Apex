// @vitest-environment node
// USDZ export runs in plain Node, not jsdom: USDZExporter zips with fflate, which checks
// `instanceof Uint8Array` — and jsdom's TextEncoder returns a Uint8Array from another realm,
// so every file would be misread as a folder. Real browsers have one realm, so this is a
// test-environment concern only. (GLB export stays in export.test.ts: it needs FileReader.)
import { describe, expect, it } from "vitest";
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry } from "three";
import { strFromU8, unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { exportUsdz, prepareArScene } from "../../src/lib/ar/exportModel";

function makeShowroomCar(paint: string) {
  const body = new Mesh(new BoxGeometry(4.2, 1.2, 1.9), new MeshStandardMaterial({ name: "Paint", color: paint }));
  const car = new Group().add(body);
  car.updateMatrixWorld(true);
  return car;
}

describe("exportUsdz — iOS (AC-3)", () => {
  it("writes a Quick Look-compatible USDZ (a zip holding a .usda scene) with the current paint", async () => {
    const file = await exportUsdz(prepareArScene(makeShowroomCar("#b3121b"), 4.62));
    const files = unzipSync(file.bytes);

    expect(file.mimeType).toBe("model/vnd.usdz+zip");
    expect(Object.keys(files)).toContain("model.usda");
    const usda = strFromU8(files["model.usda"]);
    expect(usda).toContain("#usda 1.0");
    expect(usda).toMatch(/metersPerUnit = 1/);
    const paint = new Color("#b3121b");
    expect(usda).toContain(`color3f inputs:diffuseColor = (${paint.r}, ${paint.g}, ${paint.b})`);
  });

  it("simplifies geometry when a triangle ratio is given, shrinking the file", async () => {
    const heavy = () => {
      const g = new Group();
      g.add(new Mesh(new SphereGeometry(2, 64, 48), new MeshStandardMaterial({ color: "#ffffff" })));
      g.updateMatrixWorld(true);
      return prepareArScene(g, 4.5);
    };
    const full = await exportUsdz(heavy());
    const reduced = await exportUsdz(heavy(), 0.3);
    expect(reduced.bytes.length).toBeLessThan(full.bytes.length * 0.5);
  });
});
