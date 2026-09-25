import "dotenv/config";
import { readFile } from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");
const { DOCUMENTED_ROUTES, UNDOCUMENTED_ROUTES } = await import("../../src/openapi/routes.js");
const { SCHEMAS_OUTPUT_PATH, generateSchemas, serializeSchemas } = await import("../../scripts/generateOpenApiSchemas.js");

type JsonObject = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface ExpressLayer {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: ExpressLayer[] };
}

/** Every method+path actually mounted on the app, relative to /api. Every router in app.ts
 * is mounted at "/api"; the one app-level route (the Stripe webhook) carries the full path. */
function mountedRoutes(): string[] {
  const app = createApp() as unknown as { _router: { stack: ExpressLayer[] } };
  const routes: string[] = [];
  const collect = (layer: ExpressLayer, prefix: string) => {
    if (!layer.route) return;
    for (const method of Object.keys(layer.route.methods)) routes.push(`${method} ${prefix}${layer.route.path}`);
  };
  for (const layer of app._router.stack) {
    collect(layer, "");
    if (layer.name === "router") for (const inner of layer.handle?.stack ?? []) collect(inner, "/api");
  }
  return routes.map((r) => r.replace(" /api/", " /"));
}

describe("OpenAPI documentation (integration, Spec 26)", () => {
  let doc: JsonObject;

  beforeAll(async () => {
    await seedDatabase(prisma);
    const res = await request(createApp()).get("/api/docs");
    expect(res.status).toBe(200);
    doc = res.body;
  });

  it("serves a document that validates against the OpenAPI 3.x schema (AC-3)", async () => {
    expect(doc.openapi).toMatch(/^3\.1\./);
    await expect(SwaggerParser.validate(structuredClone(doc) as never)).resolves.toBeDefined();
  });

  it("describes POST /pricing/calculate with its real request and response shapes", () => {
    const op = doc.paths["/pricing/calculate"].post;
    expect(op.requestBody.content["application/json"].schema.$ref).toBe("#/components/schemas/PriceCalculationRequest");
    expect(op.responses["200"].content["application/json"].schema.properties.data.$ref).toBe(
      "#/components/schemas/PriceBreakdownDto",
    );
    expect(op.responses["422"].description).toContain("OPTION_VEHICLE_MISMATCH");

    const request = doc.components.schemas.PriceCalculationRequest;
    expect(request.required).toEqual(expect.arrayContaining(["vehicleSlug", "singleSelections", "multiSelections"]));
    expect(doc.components.schemas.PriceBreakdownDto.properties.totalPriceCents.type).toBe("number");
  });

  it("templates path parameters and marks signed-in routes with the session cookie", () => {
    const op = doc.paths["/configurations/{publicId}/claim"].post;
    expect(op.parameters).toEqual([{ name: "publicId", in: "path", required: true, schema: { type: "string" } }]);
    expect(op.security).toEqual([{ sessionCookie: [] }]);
    expect(doc.components.securitySchemes.sessionCookie).toEqual({ type: "apiKey", in: "cookie", name: "apex_session" });
  });

  it("documents every mounted route, except the explicitly excluded internal ones", () => {
    const documented = new Set([
      ...DOCUMENTED_ROUTES.map((r) => `${r.method} ${r.path}`),
      ...UNDOCUMENTED_ROUTES.map((r) => `${r.method} ${r.path}`),
    ]);
    const missing = mountedRoutes().filter((route) => !documented.has(route));
    expect(missing).toEqual([]);
  });

  it("doesn't document or exclude routes that no longer exist", () => {
    const mounted = new Set(mountedRoutes());
    const stale = [...DOCUMENTED_ROUTES, ...UNDOCUMENTED_ROUTES]
      .map((r) => `${r.method} ${r.path}`)
      .filter((route) => !mounted.has(route));
    expect(stale).toEqual([]);
  });

  it("only references schemas that exist", () => {
    const refs = [...JSON.stringify(doc).matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g)].map(([, name]) => name);
    expect(refs.filter((name) => !(name in doc.components.schemas))).toEqual([]);
  });

  it("has committed schemas that match the current src/types (run `npm run openapi:generate` if this fails)", async () => {
    expect(await readFile(SCHEMAS_OUTPUT_PATH, "utf8")).toBe(serializeSchemas(generateSchemas()));
  });

  it("matches what the running API actually returns — GET /vehicles items have exactly the documented fields", async () => {
    const res = await request(createApp()).get("/api/vehicles");
    const schema = doc.components.schemas.VehicleSummaryDto;
    for (const vehicle of res.body.data) {
      expect(Object.keys(vehicle).sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });

  it("matches what the running API actually returns — GET /health", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(Object.keys(res.body).sort()).toEqual(Object.keys(doc.components.schemas.HealthResponse.properties).sort());
  });

  it("serves a human-readable Swagger UI at /api/docs/ui (AC-4)", async () => {
    const res = await request(createApp()).get("/api/docs/ui/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("swagger-ui");
  });
});
