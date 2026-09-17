import { prisma } from "../src/lib/db";
import {
  normalizeEmail,
  normalizeLinkedInUrl,
  computeCompositeHash,
} from "../src/lib/deduplication/normalizer";

export interface BackfillResult {
  totalExamined: number;
  updatedCount: number;
  skippedCount: number;
}

/**
 * Backfills persistent deduplication fields for existing Lead records:
 * - normalizedEmail
 * - normalizedLinkedInUrl
 * - compositeHash
 *
 * Uses the canonical normalizer functions to ensure complete consistency with application logic.
 */
export async function backfillLeadDeduplication(): Promise<BackfillResult> {
  const leads = await prisma.lead.findMany({
    include: {
      company: {
        select: {
          name: true,
          domain: true,
        },
      },
    },
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const lead of leads) {
    const targetEmail = normalizeEmail(lead.email);
    const targetLinkedIn = normalizeLinkedInUrl(lead.linkedInUrl);
    const companyRef = lead.company?.domain || lead.company?.name || null;
    const targetComposite = computeCompositeHash(lead.fullName, companyRef);

    const needsUpdate =
      lead.normalizedEmail !== targetEmail ||
      lead.normalizedLinkedInUrl !== targetLinkedIn ||
      lead.compositeHash !== targetComposite;

    if (needsUpdate) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          normalizedEmail: targetEmail,
          normalizedLinkedInUrl: targetLinkedIn,
          compositeHash: targetComposite,
        },
      });
      updatedCount++;
    } else {
      skippedCount++;
    }
  }

  return {
    totalExamined: leads.length,
    updatedCount,
    skippedCount,
  };
}

if (require.main === module) {
  backfillLeadDeduplication()
    .then((result) => {
      console.log("Lead deduplication backfill complete:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
