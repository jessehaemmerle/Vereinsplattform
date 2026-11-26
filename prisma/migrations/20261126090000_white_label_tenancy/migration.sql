-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "accentColor" TEXT NOT NULL DEFAULT '#a87a1f',
ADD COLUMN     "emailFooter" TEXT,
ADD COLUMN     "emailSenderName" TEXT,
ADD COLUMN     "faviconPath" TEXT,
ADD COLUMN     "fontKey" TEXT NOT NULL DEFAULT 'schibsted',
ADD COLUMN     "loginImagePath" TEXT,
ADD COLUMN     "loginText" TEXT,
ADD COLUMN     "loginTitle" TEXT,
ADD COLUMN     "logoDarkPath" TEXT,
ADD COLUMN     "previousSlug" TEXT,
ADD COLUMN     "primaryColor" TEXT NOT NULL DEFAULT '#2e5a44',
ADD COLUMN     "slugChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "remindersSent" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "impersonatedClubId" TEXT;

-- CreateTable
CREATE TABLE "LicensePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxUsers" INTEGER,
    "maxMembers" INTEGER,
    "durationMonths" INTEGER DEFAULT 12,
    "modules" "Module"[] DEFAULT ARRAY['MITGLIEDER', 'FINANZEN', 'EVENTS', 'NOTIZEN', 'DOKUMENTE', 'KOMMUNIKATION']::"Module"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicensePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseEvent" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicensePlan_name_key" ON "LicensePlan"("name");

-- CreateIndex
CREATE INDEX "LicenseEvent_licenseId_createdAt_idx" ON "LicenseEvent"("licenseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImpersonationTicket_tokenHash_key" ON "ImpersonationTicket"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Club_previousSlug_key" ON "Club"("previousSlug");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LicensePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseEvent" ADD CONSTRAINT "LicenseEvent_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

