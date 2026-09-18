-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('IDLE', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "ai_generations" ADD COLUMN     "confidence" TEXT DEFAULT 'medium',
ADD COLUMN     "emailBody" TEXT,
ADD COLUMN     "evidenceUsed" JSONB,
ADD COLUMN     "linkedInMessage" TEXT,
ADD COLUMN     "serviceProfile" TEXT NOT NULL DEFAULT 'web_development',
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "whyProspect" TEXT,
ALTER COLUMN "type" SET DEFAULT 'COLD_EMAIL';

-- AlterTable
ALTER TABLE "ai_researches" ADD COLUMN     "error" TEXT,
ADD COLUMN     "opportunitySignals" JSONB,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'http_researcher',
ADD COLUMN     "providerVersion" TEXT DEFAULT '1.0.0',
ADD COLUMN     "researchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "serviceProfile" TEXT NOT NULL DEFAULT 'web_development',
ADD COLUMN     "status" "ResearchStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "structuredEvidence" JSONB,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "url" TEXT;

-- CreateIndex
CREATE INDEX "ai_researches_userId_companyId_idx" ON "ai_researches"("userId", "companyId");
