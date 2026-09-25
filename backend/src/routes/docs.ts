import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiDocument } from "../openapi/document.js";

export const docsRouter = Router();

// Built once at startup — it's derived only from code (routes.ts + the generated schemas),
// so it can't change while the process runs.
const openApiDocument = buildOpenApiDocument();

/** Spec 26, AC-3: the raw OpenAPI 3.1 document. */
docsRouter.get("/docs", (_req, res) => {
  res.status(200).json(openApiDocument);
});

/** Spec 26, AC-4: Swagger UI, served from this backend's own node_modules (no external CDN). */
docsRouter.use("/docs/ui", swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: "APEX API Docs" }));
