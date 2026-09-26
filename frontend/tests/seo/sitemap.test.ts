import { describe, expect, it, vi } from "vitest";
import type { VehicleSummaryDto } from "../../src/types/catalog";

const getVehiclesMock = vi.fn();
vi.mock("../../src/lib/api/vehicles", () => ({
  getVehicles: () => getVehiclesMock(),
  getDefaultVehicleSlug: vi.fn(),
  getVehicleDetail: vi.fn(),
}));

const sitemap = (await import("../../src/app/sitemap")).default;
const robots = (await import("../../src/app/robots")).default;

function makeVehicle(slug: string): VehicleSummaryDto {
  return {
    slug,
    name: slug,
    tagline: "",
    basePriceCents: 0,
    currency: "EUR",
    horsepower: 0,
    topSpeedKph: 0,
    zeroToHundredSec: 0,
    thumbnailUrl: "",
    fallbackImageUrl: "",
    heroModelUrl: "",
    showroomModelUrl: "",
  };
}

describe("sitemap (Spec 23, AC-3)", () => {
  it("lists the static marketing routes plus one /configure/{slug} entry per active vehicle", async () => {
    getVehiclesMock.mockResolvedValueOnce([makeVehicle("apex-gt"), makeVehicle("apex-rs")]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/",
        "http://localhost:3000/models",
        "http://localhost:3000/compare",
        "http://localhost:3000/gallery",
        "http://localhost:3000/about",
        "http://localhost:3000/privacy-policy",
        "http://localhost:3000/configure/apex-gt",
        "http://localhost:3000/configure/apex-rs",
      ]),
    );
    expect(urls).toHaveLength(8);
  });

  it("never includes a user-specific saved-build (?build=) URL, /garage, or /admin", async () => {
    getVehiclesMock.mockResolvedValueOnce([makeVehicle("apex-gt")]);

    const entries = await sitemap();

    for (const entry of entries) {
      expect(entry.url).not.toContain("?build=");
      expect(entry.url).not.toContain("/garage");
      expect(entry.url).not.toContain("/admin");
    }
  });
});

describe("robots (Spec 23, AC-3)", () => {
  it("disallows every private/access-gated route and points at the sitemap", () => {
    const { rules, sitemap: sitemapUrl } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;

    expect(rule.disallow).toEqual(
      expect.arrayContaining(["/admin", "/garage", "/reservations", "/login", "/signup"]),
    );
    expect(sitemapUrl).toBe("http://localhost:3000/sitemap.xml");
  });
});
