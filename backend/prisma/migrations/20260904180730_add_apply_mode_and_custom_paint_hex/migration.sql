-- CreateEnum
CREATE TYPE "ApplyMode" AS ENUM ('MATERIAL_SWAP', 'MESH_VARIANT_SWAP', 'MESH_VISIBILITY');

-- AlterTable
ALTER TABLE "Configuration" ADD COLUMN     "customPaintHex" TEXT;

-- AlterTable
ALTER TABLE "CustomizationOption" ADD COLUMN     "applyMode" "ApplyMode" NOT NULL DEFAULT 'MATERIAL_SWAP';
