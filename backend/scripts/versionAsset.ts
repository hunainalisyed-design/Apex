/**
 * Publishes an asset under its content-addressed name (Spec 25, AC-1/AC-2) and prints the URL
 * to paste into the Spec 21 admin form. Never overwrites or deletes an existing file.
 *
 * Usage: npm run assets:version -- <sourceFile> [subdir]
 *   subdir defaults to "assets/models"; relative to the frontend's public/ directory
 *   (override the root with ASSETS_PUBLIC_ROOT).
 */
import { resolve } from "node:path";
import { publishVersionedAsset } from "../src/services/assets/publish.js";

const DEFAULT_PUBLIC_ROOT = resolve(import.meta.dirname, "../../frontend/public");

async function main() {
  const [sourceFile, subdir = "assets/models"] = process.argv.slice(2);
  if (!sourceFile) {
    console.error("Usage: npm run assets:version -- <sourceFile> [subdir]");
    process.exitCode = 1;
    return;
  }

  const publicRoot = process.env.ASSETS_PUBLIC_ROOT ?? DEFAULT_PUBLIC_ROOT;
  const result = await publishVersionedAsset(resolve(sourceFile), publicRoot, subdir);
  console.log(result.created ? `Published ${result.filePath}` : `Already published (identical content): ${result.filePath}`);
  console.log(`URL: ${result.url}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
