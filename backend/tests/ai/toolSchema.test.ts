import { Prisma, type CustomizationOption, type Vehicle } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { mapVehicleToDetailDto } from "../../src/services/catalog.js";
import { buildConfigureToolSchema, CONFIGURE_TOOL_NAME } from "../../src/services/ai/buildToolSchema.js";
import { ALL_CATEGORIES, MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "vehicle_1",
    slug: "apex-gt",
    name: "Apex GT",
    tagline: "Performance sports car.",
    basePriceCents: 8_500_000,
    currency: "EUR",
    horsepower: 450,
    topSpeedKph: 280,
    zeroToHundredSec: new Prisma.Decimal("4.2"),
    heroModelUrl: "/models/apex-gt/hero.glb",
    showroomModelUrl: "/models/apex-gt/showroom.glb",
    thumbnailUrl: "/models/apex-gt/thumbnail.jpg",
    fallbackImageUrl: "/models/apex-gt/fallback.jpg",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeOption(overrides: Partial<CustomizationOption> = {}): CustomizationOption {
  return {
    id: "option_1",
    vehicleId: "vehicle_1",
    category: "PAINT",
    name: "Obsidian Black",
    description: null,
    priceDeltaCents: 0,
    assetRef: "paint-obsidian-black",
    swatchColor: "#0a0a0c",
    applyMode: "MATERIAL_SWAP",
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface JsonSchemaProperty {
  anyOf?: { type: string; enum?: string[]; items?: { enum?: string[] } }[];
}

describe("buildConfigureToolSchema (Spec 14, AC-1)", () => {
  it("forces strict mode with no additional properties", () => {
    const dto = mapVehicleToDetailDto(makeVehicle(), []);
    const tool = buildConfigureToolSchema(dto);

    expect(tool.name).toBe(CONFIGURE_TOOL_NAME);
    expect(tool.strict).toBe(true);
    const schema = tool.input_schema as unknown as { additionalProperties: boolean; required: string[] };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("assistantMessage");
  });

  it("every single-select category's enum exactly matches that vehicle's real option ids for it", () => {
    const options = [
      makeOption({ id: "paint-a", category: "PAINT" }),
      makeOption({ id: "paint-b", category: "PAINT" }),
      makeOption({ id: "wheels-a", category: "WHEELS" }),
    ];
    const dto = mapVehicleToDetailDto(makeVehicle(), options);
    const tool = buildConfigureToolSchema(dto);
    const properties = (tool.input_schema as unknown as { properties: Record<string, JsonSchemaProperty> }).properties;

    const paintEnum = properties.PAINT.anyOf?.find((branch) => branch.type === "string")?.enum;
    expect(paintEnum).toEqual(["paint-a", "paint-b"]);

    const wheelsEnum = properties.WHEELS.anyOf?.find((branch) => branch.type === "string")?.enum;
    expect(wheelsEnum).toEqual(["wheels-a"]);

    // A category with no options for this vehicle gets an empty (never-satisfiable-except-null) enum,
    // not omitted — every category is always a required property (AC-4's all-null "no recommendation").
    const brakeEnum = properties.BRAKE_CALIPER.anyOf?.find((branch) => branch.type === "string")?.enum;
    expect(brakeEnum).toEqual([]);
  });

  it("every multi-select category's enum exactly matches that vehicle's real option ids for it", () => {
    const options = [
      makeOption({ id: "acc-a", category: "ACCESSORY" }),
      makeOption({ id: "acc-b", category: "ACCESSORY" }),
    ];
    const dto = mapVehicleToDetailDto(makeVehicle(), options);
    const tool = buildConfigureToolSchema(dto);
    const properties = (tool.input_schema as unknown as { properties: Record<string, JsonSchemaProperty> }).properties;

    const accessoryEnum = properties.ACCESSORY.anyOf?.find((branch) => branch.type === "array")?.items?.enum;
    expect(accessoryEnum).toEqual(["acc-a", "acc-b"]);
  });

  it("lists every category from ALL_CATEGORIES as a required property, plus assistantMessage", () => {
    const dto = mapVehicleToDetailDto(makeVehicle(), []);
    const tool = buildConfigureToolSchema(dto);
    const schema = tool.input_schema as unknown as { required: string[] };

    expect(schema.required.sort()).toEqual(["assistantMessage", ...ALL_CATEGORIES].sort());
    expect(schema.required).toHaveLength(SINGLE_SELECT_CATEGORIES.length + MULTI_SELECT_CATEGORIES.length + 1);
  });
});
