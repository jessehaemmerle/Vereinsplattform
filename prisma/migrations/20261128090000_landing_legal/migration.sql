-- AlterTable
ALTER TABLE "LicensePlan" ADD COLUMN     "highlighted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "publicListed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "operatorName" TEXT,
    "legalForm" TEXT,
    "street" TEXT,
    "zipCity" TEXT,
    "country" TEXT DEFAULT 'Österreich',
    "email" TEXT,
    "phone" TEXT,
    "vatId" TEXT,
    "companyRegister" TEXT,
    "businessPurpose" TEXT,
    "authority" TEXT,
    "chamber" TEXT,
    "representative" TEXT,
    "hostingProvider" TEXT,
    "mailProvider" TEXT,
    "contactEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "members" INTEGER,
    "message" TEXT,
    "planId" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LicensePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

