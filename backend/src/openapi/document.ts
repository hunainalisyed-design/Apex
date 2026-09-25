import schemas from "./schemas.generated.json" with { type: "json" };
import { SESSION_COOKIE_NAME } from "../services/auth/session.js";
import { DOCUMENTED_ROUTES, type RouteDoc } from "./routes.js";

type JsonObject = Record<string, unknown>;

const SESSION_COOKIE = "sessionCookie";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** "/vehicles/:slug" → "/vehicles/{slug}" (OpenAPI path templating). */
export function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function pathParameters(expressPath: string) {
  return [...expressPath.matchAll(/:([A-Za-z0-9_]+)/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function successResponse(success: RouteDoc["success"]): JsonObject {
  if (!success.schema) return { description: success.description };

  let body: JsonObject = success.array ? { type: "array", items: ref(success.schema) } : ref(success.schema);
  if (success.nullable) body = { oneOf: [body, { type: "null" }] };
  if (success.envelope !== false) body = { type: "object", required: ["data"], properties: { data: body } };

  return { description: success.description, content: { "application/json": { schema: body } } };
}

function operation(route: RouteDoc): JsonObject {
  const responses: JsonObject = { [route.success.status]: successResponse(route.success) };
  for (const [status, codes] of Object.entries(route.errors ?? {})) {
    responses[status] = {
      description: `Error codes: ${codes.map((c) => `\`${c}\``).join(", ")}`,
      content: { "application/json": { schema: ref("ApiError") } },
    };
  }

  const op: JsonObject = {
    tags: [route.tag],
    summary: route.summary,
    operationId: `${route.method}${toOpenApiPath(route.path).replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ?? "").toUpperCase())}`,
    responses,
  };
  const params = pathParameters(route.path);
  if (params.length > 0) op.parameters = params;
  if (route.requestBody) {
    op.requestBody = { required: true, content: { "application/json": { schema: ref(route.requestBody) } } };
  }
  if (route.auth === "required") op.security = [{ [SESSION_COOKIE]: [] }];
  if (route.auth === "optional") op.security = [{}, { [SESSION_COOKIE]: [] }];
  return op;
}

/** The OpenAPI 3.1 document for every route in DOCUMENTED_ROUTES (Spec 26, AC-3). */
export function buildOpenApiDocument(): JsonObject {
  const paths: Record<string, JsonObject> = {};
  for (const route of DOCUMENTED_ROUTES) {
    const path = toOpenApiPath(route.path);
    paths[path] = { ...paths[path], [route.method]: operation(route) };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "APEX Virtual Car Configurator API",
      version: "1.0.0",
      description: [
        "Public API behind the APEX 3D car configurator.",
        "",
        "- Every success body is wrapped as `{ \"data\": ... }` unless noted.",
        "- Every error body is `{ code, message, details? }` (see `ApiError`); `code` values are stable.",
        "- Money is always an integer number of cents.",
        `- Signed-in requests use the httpOnly \`${SESSION_COOKIE_NAME}\` cookie set by \`/auth/signup\` or \`/auth/login\`.`,
      ].join("\n"),
    },
    servers: [{ url: "/api" }],
    tags: [...new Set(DOCUMENTED_ROUTES.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      schemas,
      securitySchemes: { [SESSION_COOKIE]: { type: "apiKey", in: "cookie", name: SESSION_COOKIE_NAME } },
    },
  };
}
