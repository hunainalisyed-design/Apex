/**
 * Periodic cleanup of superseded asset versions (Spec 25, AC-5). Reports by default; only
 * deletes with --delete, and even then only versioned files no Vehicle/CustomizationOption
 * row references that were superseded longer ago than the grace period.
 *
 * A script rather than an in-process job: the files ship with the frontend's public/
 * directory, which the running backend can't (and shouldn't) delete from in production.
 *
 * Usage: npm run assets:gc [-- --delete] [--grace-days=30]
 */
import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prisma } from "../src/lib/prisma.js";
import {
  DEFAULT_GRACE_DAYS,
  collectReferencedAssetUrls,
  findCleanupCandidates,
  listPublicAssetUrls,
  loadSupersessionDates,
} from "../src/services/assets/cleanup.js";

const DEFAULT_PUBLIC_ROOT = resolve(import.meta.dirname, "../../frontend/public");
const ASSET_SUBDIRS = ["assets", "models"];

async function main() {
  const args = process.argv.slice(2);
  const shouldDelete = args.includes("--delete");
  const graceArg = args.find((a) => a.startsWith("--grace-days="));
  const graceDays = graceArg ? Number(graceArg.split("=")[1]) : DEFAULT_GRACE_DAYS;
  if (!Number.isFinite(graceDays) || graceDays < 0) {
    console.error("--grace-days must be a non-negative number.");
    process.exitCode = 1;
    return;
  }

  const publicRoot = process.env.ASSETS_PUBLIC_ROOT ?? DEFAULT_PUBLIC_ROOT;
  const report = findCleanupCandidates({
    fileUrls: await listPublicAssetUrls(publicRoot, ASSET_SUBDIRS),
    referencedUrls: await collectReferencedAssetUrls(prisma),
    supersededAt: await loadSupersessionDates(prisma),
    now: new Date(),
    graceDays,
  });

  console.log(`Eligible for cleanup (${report.eligible.length}):`);
  for (const url of report.eligible) console.log(`  ${url}`);
  console.log(`Kept — still in the ${graceDays}-day grace period (${report.inGracePeriod.length}):`);
  for (const { url, eligibleAt } of report.inGracePeriod) console.log(`  ${url} (eligible ${eligibleAt.toISOString()})`);
  console.log(`Kept — unreferenced but no recorded supersession, review manually (${report.untracked.length}):`);
  for (const url of report.untracked) console.log(`  ${url}`);

  if (!shouldDelete) {
    if (report.eligible.length > 0) console.log("\nDry run — re-run with --delete to remove the eligible files.");
    return;
  }
  for (const url of report.eligible) {
    await unlink(join(publicRoot, url));
    console.log(`Deleted ${url}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
