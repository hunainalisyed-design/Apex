import type { PrismaClient } from "@prisma/client";
import { validateSingleSelectDefaults } from "../src/services/catalog.js";
import { seedVehicles } from "./seedData.js";

/** Wipes and re-inserts the catalog. Idempotent — safe to call against a fresh or
 * already-seeded database (used by both the CLI seed script and the integration tests). */
export async function seedDatabase(prisma: PrismaClient) {
  for (const vehicle of seedVehicles) {
    const violations = validateSingleSelectDefaults(vehicle.options);
    if (violations.length > 0) {
      throw new Error(
        `Seed data for "${vehicle.slug}" violates the single-default invariant: ${JSON.stringify(violations)}`,
      );
    }
  }

  // FK-safe delete order: leaf tables first.
  await prisma.configurationSelection.deleteMany();
  await prisma.configuration.deleteMany();
  await prisma.customizationOption.deleteMany();
  await prisma.vehicle.deleteMany();

  for (const vehicle of seedVehicles) {
    await prisma.vehicle.create({
      data: {
        slug: vehicle.slug,
        name: vehicle.name,
        tagline: vehicle.tagline,
        basePriceCents: vehicle.basePriceCents,
        currency: vehicle.currency,
        horsepower: vehicle.horsepower,
        topSpeedKph: vehicle.topSpeedKph,
        zeroToHundredSec: vehicle.zeroToHundredSec,
        heroModelUrl: vehicle.heroModelUrl,
        showroomModelUrl: vehicle.showroomModelUrl,
        thumbnailUrl: vehicle.thumbnailUrl,
        options: {
          create: vehicle.options.map((option) => ({
            category: option.category,
            name: option.name,
            description: option.description,
            priceDeltaCents: option.priceDeltaCents,
            assetRef: option.assetRef,
            swatchColor: option.swatchColor,
            isDefault: option.isDefault,
            sortOrder: option.sortOrder,
          })),
        },
      },
    });
  }
}

async function main() {
  const { prisma } = await import("../src/lib/prisma.js");
  await seedDatabase(prisma);
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
