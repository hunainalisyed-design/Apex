-- CreateEnum
CREATE TYPE "OptionCategory" AS ENUM ('PAINT', 'WHEELS', 'BRAKE_CALIPER', 'WINDOW_TINT', 'SPOILER', 'FRONT_ACCESSORY', 'REAR_ACCESSORY', 'BODY_PACKAGE', 'CARBON_COMPONENT', 'INTERIOR_MATERIAL', 'INTERIOR_LIGHTING', 'INTERIOR_SEATS', 'INTERIOR_DASHBOARD', 'INTERIOR_STEERING_WHEEL', 'INTERIOR_DOOR_PANELS', 'INTERIOR_FLOOR', 'ACCESSORY', 'PACKAGE');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "horsepower" INTEGER NOT NULL,
    "topSpeedKph" INTEGER NOT NULL,
    "zeroToHundredSec" DECIMAL(3,1) NOT NULL,
    "heroModelUrl" TEXT NOT NULL,
    "showroomModelUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationOption" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "category" "OptionCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "assetRef" TEXT NOT NULL,
    "swatchColor" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomizationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT,
    "totalPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationSelection" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "ConfigurationSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_slug_key" ON "Vehicle"("slug");

-- CreateIndex
CREATE INDEX "CustomizationOption_vehicleId_category_idx" ON "CustomizationOption"("vehicleId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Configuration_publicId_key" ON "Configuration"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationSelection_configurationId_optionId_key" ON "ConfigurationSelection"("configurationId", "optionId");

-- AddForeignKey
ALTER TABLE "CustomizationOption" ADD CONSTRAINT "CustomizationOption_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationSelection" ADD CONSTRAINT "ConfigurationSelection_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "Configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationSelection" ADD CONSTRAINT "ConfigurationSelection_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "CustomizationOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
