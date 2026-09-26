import { describe, expect, it } from "vitest";
import { environmentSceneSettings, resolveEnvironment } from "../../src/lib/showroom/environment";
import type { EnvironmentDto } from "../../src/types/environments";

const studio: EnvironmentDto = {
  id: "studio",
  name: "Studio",
  hdriUrl: "/assets/environments/studio-1k.aaaaaaaa.hdr",
  hdriMobileUrl: "/assets/environments/studio-1k.aaaaaaaa.hdr",
  thumbnailUrl: "/assets/environments/studio-thumb.aaaaaaaa.png",
  isStudio: true,
  groundHeight: null,
  groundRadius: null,
};
const nightCity: EnvironmentDto = {
  id: "night-city",
  name: "Night City",
  hdriUrl: "/assets/environments/night-2k.bbbbbbbb.hdr",
  hdriMobileUrl: "/assets/environments/night-1k.cccccccc.hdr",
  thumbnailUrl: "/assets/environments/night-thumb.bbbbbbbb.png",
  isStudio: false,
  groundHeight: 1.6,
  groundRadius: 60,
};
const ALL = [studio, nightCity];

describe("resolveEnvironment (Spec 28)", () => {
  it("returns the stored environment", () => {
    expect(resolveEnvironment(ALL, "night-city")).toBe(nightCity);
  });

  it("treats null as the default Studio (AC-4: existing builds)", () => {
    expect(resolveEnvironment(ALL, null)).toBe(studio);
  });

  it("falls back to Studio for an unknown or removed id — never to no environment", () => {
    expect(resolveEnvironment(ALL, "moon-base")).toBe(studio);
  });

  it("falls back to the first environment if Studio itself is missing, and null only for an empty list", () => {
    expect(resolveEnvironment([nightCity], null)).toBe(nightCity);
    expect(resolveEnvironment([], "studio")).toBeNull();
  });
});

describe("environmentSceneSettings — backdrop and lighting always together (AC-2)", () => {
  it("drives an outdoor scene's backdrop AND lighting from one HDRI, projected onto the ground", () => {
    const settings = environmentSceneSettings(nightCity, false);
    expect(settings).toEqual({
      hdriUrl: nightCity.hdriUrl,
      backdrop: "ground",
      ground: { height: 1.6, radius: 60 },
      showStudioFloor: false,
    });
  });

  it("keeps the studio backdrop and floor for Studio, using its HDRI for lighting only", () => {
    const settings = environmentSceneSettings(studio, false);
    expect(settings.backdrop).toBe("studio");
    expect(settings.ground).toBeNull();
    expect(settings.showStudioFloor).toBe(true);
    expect(settings.hdriUrl).toBe(studio.hdriUrl);
  });

  it("uses the smaller HDRI on small screens (Risk #1) — for backdrop and lighting alike", () => {
    expect(environmentSceneSettings(nightCity, true).hdriUrl).toBe(nightCity.hdriMobileUrl);
    expect(environmentSceneSettings(nightCity, false).hdriUrl).toBe(nightCity.hdriUrl);
  });

  it("never pairs a ground-projected backdrop with the studio floor, or vice versa", () => {
    for (const env of ALL) {
      for (const small of [true, false]) {
        const s = environmentSceneSettings(env, small);
        expect(s.showStudioFloor).toBe(s.backdrop === "studio");
        expect(s.ground !== null).toBe(s.backdrop === "ground");
      }
    }
  });

  it("treats an outdoor environment missing ground values as studio-style rather than a broken projection", () => {
    const incomplete = { ...nightCity, groundHeight: null };
    expect(environmentSceneSettings(incomplete, false).backdrop).toBe("studio");
  });
});
