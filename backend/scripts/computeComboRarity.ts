/**
 * Runs Spec 32's combo-rarity aggregation once, on demand — the same job the server runs
 * hourly. Useful after seeding data, or to refresh the badges without waiting.
 *
 * Usage: npm run rarity:compute
 */
import { prisma } from "../src/lib/prisma.js";
import { computeComboRarity } from "../src/services/comboRarity.js";

async function main() {
  const summary = await computeComboRarity();
  console.log(
    `Combo rarity computed: ${summary.builds} builds across ${summary.vehicles} vehicles, ${summary.combos} paint + wheels pairs (${summary.durationMs} ms).`,
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
