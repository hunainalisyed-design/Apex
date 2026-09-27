-- CreateTable
CREATE TABLE "ComboRarityStat" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "paintId" TEXT NOT NULL,
    "wheelsId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "firstConfigurationId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComboRarityStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComboRarityStat_vehicleId_paintId_wheelsId_key" ON "ComboRarityStat"("vehicleId", "paintId", "wheelsId");

-- AddForeignKey
ALTER TABLE "ComboRarityStat" ADD CONSTRAINT "ComboRarityStat_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
