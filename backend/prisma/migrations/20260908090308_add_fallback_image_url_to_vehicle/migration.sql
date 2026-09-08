-- AlterTable
-- Added with a temporary default so it applies against existing seeded rows (a real seed
-- always deletes+recreates every Vehicle row anyway, so this default value never persists
-- in practice); dropped immediately after so no accidental silent default remains.
ALTER TABLE "Vehicle" ADD COLUMN     "fallbackImageUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vehicle" ALTER COLUMN "fallbackImageUrl" DROP DEFAULT;
