-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "oneTimePasswordEnc" TEXT,
ADD COLUMN     "oneTimePasswordExp" TIMESTAMP(3);

