/**
 * Generates the OpenAPI component schemas (Spec 26, AC-3) straight from the DTO types in
 * src/types/ — the same types the routes use — so the docs can't drift from the code.
 * The output is committed (the running server has no TypeScript compiler to do this at
 * runtime), and tests/integration/openapi.int.test.ts fails if it's stale.
 *
 * Usage: npm run openapi:generate
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGenerator } from "ts-json-schema-generator";

const BACKEND_ROOT = resolve(import.meta.dirname, "..");
export const SCHEMAS_OUTPUT_PATH = resolve(BACKEND_ROOT, "src/openapi/schemas.generated.json");

// Every types/ file except express.d.ts (a module augmentation, not DTOs).
const TYPE_FILES = [
  "admin",
  "ai",
  "api",
  "ar",
  "auth",
  "catalog",
  "configuration",
  "environments",
  "garage",
  "gdpr",
  "health",
  "leads",
  "pricing",
  "reservations",
];

export type SchemaMap = Record<string, unknown>;

/** JSON Schemas for every exported DTO type, keyed by type name, with `$ref`s rewritten to
 * OpenAPI's `#/components/schemas/` location. Generic types (ApiResponse<T>) are skipped by
 * the generator; the document builder wraps responses in the `{ data }` envelope itself. */
export function generateSchemas(): SchemaMap {
  const schema = createGenerator({
    path: resolve(BACKEND_ROOT, `src/types/{${TYPE_FILES.join(",")}}.ts`),
    tsconfig: resolve(BACKEND_ROOT, "tsconfig.json"),
    type: "*",
    expose: "export",
    topRef: true,
    jsDoc: "basic",
    skipTypeCheck: true,
  }).createSchema("*");

  const definitions = schema.definitions ?? {};
  const sorted = Object.fromEntries(Object.keys(definitions).sort().map((name) => [name, definitions[name]]));
  return JSON.parse(JSON.stringify(sorted).replaceAll("#/definitions/", "#/components/schemas/")) as SchemaMap;
}

export function serializeSchemas(schemas: SchemaMap): string {
  return JSON.stringify(schemas, null, 2) + "\n";
}

if (process.argv[1]?.endsWith("generateOpenApiSchemas.ts")) {
  const schemas = generateSchemas();
  await writeFile(SCHEMAS_OUTPUT_PATH, serializeSchemas(schemas));
  console.log(`Wrote ${Object.keys(schemas).length} schemas to ${SCHEMAS_OUTPUT_PATH}`);
}
