import {
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizeDomain,
  createNameCompanyKey,
} from "./normalizer";

export type DeduplicationStrategy = "email" | "linkedin" | "name_company";

export interface DeduplicationInput {
  email?: string | null;
  linkedInUrl?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
}

export interface ExistingLeadCandidate {
  id: string;
  email?: string | null;
  linkedInUrl?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  status: "CREATED" | "ALREADY_EXISTS" | "MERGED_OR_REJECTED";
  reason: string;
  matchedLeadId?: string;
  matchedBy?: DeduplicationStrategy;
}

/**
 * Checks an incoming lead against a list of existing lead candidates.
 * Follows the strict priority hierarchy:
 * 1. Normalized Email
 * 2. Normalized LinkedIn URL
 * 3. Composite (Name + Company/Domain)
 */
export function checkDuplicate(
  incoming: DeduplicationInput,
  candidates: ExistingLeadCandidate[]
): DeduplicationResult {
  const normEmail = normalizeEmail(incoming.email);
  const normLinkedIn = normalizeLinkedInUrl(incoming.linkedInUrl);

  const incomingFullName =
    incoming.fullName ||
    [incoming.firstName, incoming.lastName].filter(Boolean).join(" ") ||
    null;
  const incomingCompany = incoming.companyDomain || incoming.companyName || null;
  const normCompositeKey = createNameCompanyKey(incomingFullName, incomingCompany);

  for (const candidate of candidates) {
    // Priority 1: Normalized Email
    if (normEmail && candidate.email) {
      const candidateEmail = normalizeEmail(candidate.email);
      if (candidateEmail && candidateEmail === normEmail) {
        return {
          isDuplicate: true,
          status: "ALREADY_EXISTS",
          reason: `Lead with email '${candidate.email}' already exists.`,
          matchedLeadId: candidate.id,
          matchedBy: "email",
        };
      }
    }

    // Priority 2: Normalized LinkedIn URL
    if (normLinkedIn && candidate.linkedInUrl) {
      const candidateLinkedIn = normalizeLinkedInUrl(candidate.linkedInUrl);
      if (candidateLinkedIn && candidateLinkedIn === normLinkedIn) {
        return {
          isDuplicate: true,
          status: "ALREADY_EXISTS",
          reason: `Lead with LinkedIn profile '${candidate.linkedInUrl}' already exists.`,
          matchedLeadId: candidate.id,
          matchedBy: "linkedin",
        };
      }
    }

    // Priority 3: Name + Company / Domain
    if (normCompositeKey) {
      const candidateFullName = candidate.fullName || null;
      const candidateKeys = [
        createNameCompanyKey(candidateFullName, candidate.companyName),
        createNameCompanyKey(candidateFullName, candidate.companyDomain),
      ].filter(Boolean);

      const incomingKeys = [
        createNameCompanyKey(incomingFullName, incoming.companyName),
        createNameCompanyKey(incomingFullName, incoming.companyDomain),
      ].filter(Boolean);

      const hasMatch = incomingKeys.some((inKey) =>
        candidateKeys.some((candKey) => candKey === inKey)
      );

      if (hasMatch) {
        return {
          isDuplicate: true,
          status: "ALREADY_EXISTS",
          reason: `Lead with matching name '${incomingFullName}' at company '${incomingCompany}' already exists.`,
          matchedLeadId: candidate.id,
          matchedBy: "name_company",
        };
      }
    }
  }

  return {
    isDuplicate: false,
    status: "CREATED",
    reason: "Unique lead verified. No duplicates detected.",
  };
}
