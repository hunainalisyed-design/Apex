-- AlterTable
ALTER TABLE "Configuration" ADD COLUMN     "environmentId" TEXT;

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hdriUrl" TEXT NOT NULL,
    "hdriMobileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "isStudio" BOOLEAN NOT NULL DEFAULT false,
    "groundHeight" DOUBLE PRECISION,
    "groundRadius" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
