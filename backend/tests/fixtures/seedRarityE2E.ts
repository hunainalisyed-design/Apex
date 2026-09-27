/**
 * E2E fixture for Spec 32 (frontend/e2e/rarity-badges.spec.ts shells out to this, like
 * admin.spec.ts does with promote-admin): inserts enough apex-gt builds for the rarity badges
 * to apply, including ONE build with an unusual paint + wheels pair dated earlier than any
 * other, runs the aggregation, and prints what the test needs as JSON.
 *
 * Usage: npx tsx tests/fixtures/seedRarityE2E.ts
 */
import "dotenv/config";
import { prisma } from "../../src/lib/prisma.js";
import { computeComboRarity } from "../../src/services/comboRarity.js";
import { insertBuilds, loadRarityVehicle } from "./rarityBuilds.js";

const COMMON_BUILDS = 60;

async function main() {
  const vehicle = await loadRarityVehicle(prisma, "apex-gt");
  const rarePaint = vehicle.paints[vehicle.paints.length - 1];
  const rareWheels = vehicle.wheels[vehicle.wheels.length - 1];

  await insertBuilds(prisma, vehicle, vehicle.defaults.PAINT, vehicle.defaults.WHEELS, COMMON_BUILDS);
  // Dated before anything else, and earlier on every run (the DB keeps earlier runs' rows), so
  // this build is always the pair's earliest — the "first to configure" one.
  const createdAt = new Date(Date.UTC(2000, 0, 1) - (Date.now() - Date.UTC(2026, 0, 1)));
  const [rarePublicId] = await insertBuilds(prisma, vehicle, rarePaint, rareWheels, 1, { createdAt });

  await computeComboRarity();

  const names = await prisma.customizationOption.findMany({
    where: { id: { in: [rarePaint, rareWheels, vehicle.defaults.WHEELS] } },
    select: { id: true, name: true },
  });
  const nameOf = (id: string) => names.find((n) => n.id === id)!.name;
  console.log(
    JSON.stringify({
      rarePublicId,
      rarePaintName: nameOf(rarePaint),
      rareWheelsName: nameOf(rareWheels),
      defaultWheelsName: nameOf(vehicle.defaults.WHEELS),
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
