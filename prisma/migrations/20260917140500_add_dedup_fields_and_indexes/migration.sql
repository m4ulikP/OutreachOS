-- DropIndex
DROP INDEX "companies_userId_name_idx";

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "compositeHash" TEXT,
ADD COLUMN     "normalizedEmail" TEXT,
ADD COLUMN     "normalizedLinkedInUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "companies_userId_name_key" ON "companies"("userId", "name");

-- CreateIndex
CREATE INDEX "follow_ups_status_scheduledFor_idx" ON "follow_ups"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "leads_userId_normalizedEmail_idx" ON "leads"("userId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "leads_userId_normalizedLinkedInUrl_idx" ON "leads"("userId", "normalizedLinkedInUrl");

-- CreateIndex
CREATE INDEX "leads_userId_compositeHash_idx" ON "leads"("userId", "compositeHash");
