/**
 * OutreachOS Lead Normalization Engine
 * Provides deterministic canonical forms for emails, LinkedIn URLs, domains, and names
 * to power the 3-tier duplicate detection system.
 */

/**
 * Normalizes an email address:
 * - Trims whitespace
 * - Converts to lowercase
 * - Normalizes plus addressing / sub-addressing (optional flag, but we keep core for exact mailbox matching)
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;

  const parts = trimmed.split("@");
  if (parts.length !== 2) return null;

  let [localPart, domain] = parts;
  localPart = localPart.trim();
  domain = domain.trim();

  // Strip trailing periods if any
  domain = domain.replace(/\.+$/, "");

  // For gmail and googlemail, strip dots in local part and unify domain
  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }
  if (domain === "gmail.com") {
    localPart = localPart.replace(/\./g, "");
    // Remove plus addressing for gmail
    const plusIndex = localPart.indexOf("+");
    if (plusIndex !== -1) {
      localPart = localPart.substring(0, plusIndex);
    }
  }

  return `${localPart}@${domain}`;
}

/**
 * Normalizes a LinkedIn profile URL:
 * - Removes protocol (http/https)
 * - Removes www and localized subdomains (e.g., uk.linkedin.com -> linkedin.com)
 * - Removes trailing slashes
 * - Removes query parameters and hash fragments
 * - Extracts canonical slug identifier (e.g., linkedin.com/in/john-doe)
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let cleaned = url.trim().toLowerCase();
  if (!cleaned) return null;

  // Add dummy protocol if missing to use URL parser
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    let hostname = parsed.hostname.toLowerCase();

    // Only process LinkedIn URLs
    if (!hostname.includes("linkedin.com")) {
      return null;
    }

    // Unify subdomains: www., in., uk., etc.
    hostname = "linkedin.com";

    // Clean pathname: e.g. /in/johndoe/ or /in/johndoe
    let pathname = parsed.pathname.replace(/\/+$/, ""); // Remove trailing slashes
    if (!pathname.startsWith("/in/")) {
      // If it's just a vanity slug or company, format it
      if (pathname.startsWith("/")) {
        pathname = "/in" + pathname;
      }
    }

    return `https://${hostname}${pathname}`;
  } catch {
    // Fallback regex cleanup
    cleaned = cleaned.replace(/^https?:\/\//, "").replace(/^www\./, "");
    cleaned = cleaned.split("?")[0].split("#")[0].replace(/\/+$/, "");
    if (cleaned.includes("linkedin.com")) {
      return cleaned;
    }
    return null;
  }
}

/**
 * Normalizes a company domain or website:
 * - Extracts root host without protocol, www, paths, or query params
 */
export function normalizeDomain(domainOrUrl: string | null | undefined): string | null {
  if (!domainOrUrl) return null;
  let cleaned = domainOrUrl.trim().toLowerCase();
  if (!cleaned || cleaned.includes(" ")) return null;
  if (!cleaned.includes(".")) return null;

  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    let host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    cleaned = cleaned.replace(/^https?:\/\//, "").replace(/^www\./, "");
    cleaned = cleaned.split("/")[0].split("?")[0];
    return cleaned || null;
  }
}

/**
 * Normalizes a human or company name for fuzzy matching:
 * - Lowercases, removes punctuation, trims excessive spaces
 * - Strips common corporate entity suffixes (inc, llc, corp, ltd, co)
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  let cleaned = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // Strip symbols and punctuation
    .replace(/\s+/g, " ")
    .trim();

  // Strip trailing legal suffixes: inc, llc, corp, ltd, co, company
  cleaned = cleaned
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

/**
 * Creates a normalized composite key for (Full Name + Company / Domain):
 * Used as the 3rd tier of duplicate detection when neither email nor LinkedIn URL is available.
 */
export function createNameCompanyKey(
  fullName: string | null | undefined,
  companyNameOrDomain: string | null | undefined
): string | null {
  const normName = normalizeName(fullName);
  const normCompany = normalizeDomain(companyNameOrDomain) || normalizeName(companyNameOrDomain);

  if (!normName || !normCompany) {
    return null;
  }

  return `${normName}:::${normCompany}`;
}

/**
 * Canonical helper for computing the compositeHash stored in the Lead model.
 * Uses createNameCompanyKey ensuring 100% logic consistency across all database operations.
 */
export function computeCompositeHash(
  fullName: string | null | undefined,
  companyNameOrDomain: string | null | undefined
): string | null {
  return createNameCompanyKey(fullName, companyNameOrDomain);
}
