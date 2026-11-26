-- CreateEnum
CREATE TYPE "MfaPolicy" AS ENUM ('OPTIONAL', 'BOARD', 'ALL');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "mfaPolicy" "MfaPolicy" NOT NULL DEFAULT 'OPTIONAL';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "mfaAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mfaPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webauthnChallenge" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recoveryHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecretEnc" TEXT;

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rpId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "Passkey"("userId");

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

