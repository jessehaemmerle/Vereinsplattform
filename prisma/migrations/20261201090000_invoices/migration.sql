-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('KLEINUNTERNEHMER', 'STEUERPFLICHTIG', 'NICHT_STEUERBAR');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('INVOICE', 'CANCELLATION');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "bic" TEXT,
ADD COLUMN     "invoiceFooter" TEXT,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'RE',
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "taxMode" "TaxMode" NOT NULL DEFAULT 'NICHT_STEUERBAR',
ADD COLUMN     "vatId" TEXT;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bic" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "invoiceFooter" TEXT,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'RE',
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "taxMode" "TaxMode" NOT NULL DEFAULT 'KLEINUNTERNEHMER';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "invoiceId" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "vatId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "issuerClubId" TEXT,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'INVOICE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "number" TEXT,
    "issueDate" DATE,
    "servicePeriod" TEXT,
    "dueDate" DATE,
    "taxMode" "TaxMode" NOT NULL,
    "issuerSnapshot" JSONB,
    "recipientClubId" TEXT,
    "recipientContactId" TEXT,
    "recipientMemberId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT,
    "recipientEmail" TEXT,
    "recipientVatId" TEXT,
    "intro" TEXT,
    "notes" TEXT,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "licenseId" TEXT,
    "cancelsId" TEXT,
    "sentAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "paidAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT,
    "unitCents" INTEGER NOT NULL,
    "taxRate" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "issuerKey" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("issuerKey","year")
);

-- CreateIndex
CREATE INDEX "Contact_clubId_name_idx" ON "Contact"("clubId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_cancelsId_key" ON "Invoice"("cancelsId");

-- CreateIndex
CREATE INDEX "Invoice_issuerClubId_status_idx" ON "Invoice"("issuerClubId", "status");

-- CreateIndex
CREATE INDEX "Invoice_recipientClubId_idx" ON "Invoice"("recipientClubId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_issuerClubId_number_key" ON "Invoice"("issuerClubId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_invoiceId_key" ON "Transaction"("invoiceId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issuerClubId_fkey" FOREIGN KEY ("issuerClubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_recipientClubId_fkey" FOREIGN KEY ("recipientClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_recipientContactId_fkey" FOREIGN KEY ("recipientContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_recipientMemberId_fkey" FOREIGN KEY ("recipientMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancelsId_fkey" FOREIGN KEY ("cancelsId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Platform invoices have issuerClubId = NULL; NULLs are distinct in unique indexes, so guard their numbers separately.
CREATE UNIQUE INDEX "Invoice_platform_number_key" ON "Invoice"("number") WHERE "issuerClubId" IS NULL;
