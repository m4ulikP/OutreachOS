-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('NO_WEBSITE', 'WEBSITE_IMPROVEMENT', 'ACTIVE_PROJECT', 'REDESIGN_REQUEST', 'DEVELOPMENT_REQUEST');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('IDENTIFIED', 'QUALIFIED', 'PITCH_DRAFTED', 'CONTACTED', 'IN_DISCUSSION', 'CONVERTED', 'PASSED');

-- CreateEnum
CREATE TYPE "OpportunitySource" AS ENUM ('GOOGLE_PLACES', 'HUNTER_DISCOVER', 'HUNTER_DOMAIN_SEARCH', 'PUBLIC_FEED', 'MANUAL', 'CSV_IMPORT');

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "leadId" TEXT,
    "researchId" TEXT,
    "type" "OpportunityType" NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'IDENTIFIED',
    "source" "OpportunitySource" NOT NULL DEFAULT 'GOOGLE_PLACES',
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "budget" TEXT,
    "currency" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "evidence" JSONB,
    "opportunitySignals" JSONB,
    "requestedServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetUrl" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_userId_stage_idx" ON "opportunities"("userId", "stage");

-- CreateIndex
CREATE INDEX "opportunities_userId_type_idx" ON "opportunities"("userId", "type");

-- CreateIndex
CREATE INDEX "opportunities_userId_companyId_idx" ON "opportunities"("userId", "companyId");

-- CreateIndex
CREATE INDEX "opportunities_userId_leadId_idx" ON "opportunities"("userId", "leadId");

-- CreateIndex
CREATE INDEX "opportunities_userId_researchId_idx" ON "opportunities"("userId", "researchId");

-- CreateIndex
CREATE INDEX "opportunities_userId_discoveredAt_idx" ON "opportunities"("userId", "discoveredAt");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ai_researches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
