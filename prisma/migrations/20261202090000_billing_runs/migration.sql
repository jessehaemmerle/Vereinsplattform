-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "feeYear" INTEGER,
ADD COLUMN     "licensePeriodEnd" DATE;

-- CreateIndex
CREATE INDEX "Invoice_licenseId_idx" ON "Invoice"("licenseId");

-- CreateIndex
CREATE INDEX "Invoice_recipientMemberId_feeYear_idx" ON "Invoice"("recipientMemberId", "feeYear");


-- existing subscription invoices bill the license period current at that time
UPDATE "Invoice" i SET "licensePeriodEnd" = l."validUntil" FROM "License" l WHERE i."licenseId" = l."id" AND i."licensePeriodEnd" IS NULL;
