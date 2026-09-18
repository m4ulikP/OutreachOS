export interface StructuredEvidence {
  identity: {
    pageTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    detectedBusinessName: string | null;
  };
  technical: {
    hasHttps: boolean;
    isFinalHttps: boolean;
    hasViewportMeta: boolean;
    viewportContent: string | null;
    isResponsive: boolean;
    semanticTags: {
      hasHeader: boolean;
      hasNav: boolean;
      hasMain: boolean;
      hasFooter: boolean;
      h1Count: number;
    };
    accessibility: {
      totalImages: number;
      imagesWithAlt: number;
      imagesWithoutAlt: number;
    };
  };
  business: {
    emails: string[];
    phones: string[];
    addresses: string[];
    hasOnlineBooking: boolean;
    bookingLinks: string[];
    hasEcommerce: boolean;
    detectedCtas: string[];
    primaryNavItems: string[];
  };
  technology: {
    detectedPlatforms: string[];
    generatorTag: string | null;
  };
  social: {
    linkedIn: string | null;
    instagram: string | null;
    facebook: string | null;
    twitter: string | null;
    github: string | null;
  };
  researchedUrl: string;
  finalUrl: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function truncateString(str: string | null | undefined, maxLength: number): string | null {
  if (!str) return null;
  const decoded = decodeHtmlEntities(str);
  if (decoded.length <= maxLength) return decoded;
  return decoded.slice(0, maxLength).trim() + "…";
}

/**
 * Extracts structured, factual evidence from raw HTML content and response metadata.
 * Never invents claims; strictly analyzes observable DOM patterns.
 */
export function extractStructuredEvidence(params: {
  html: string;
  requestedUrl: string;
  finalUrl: string;
  isFinalHttps: boolean;
  headers?: Record<string, string>;
}): StructuredEvidence {
  const { html, requestedUrl, finalUrl, isFinalHttps, headers = {} } = params;

  // 1. Identity Extraction
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ||
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
  const pageTitle = truncateString(rawTitle, 160);

  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const metaDescription = truncateString(metaDescMatch ? metaDescMatch[1] : null, 300);

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const canonicalUrl = truncateString(canonicalMatch ? canonicalMatch[1] : null, 250);

  const ogSiteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  let detectedBusinessName = ogSiteNameMatch ? truncateString(ogSiteNameMatch[1], 80) : null;

  if (!detectedBusinessName && pageTitle) {
    // Attempt extracting brand name from title delimiters (e.g. "Acme Corp | Top Web Studio" -> "Acme Corp")
    const parts = pageTitle.split(/[|•–-]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      detectedBusinessName = truncateString(parts[0].length < parts[1].length ? parts[0] : parts[1], 80);
    } else if (parts.length === 1 && parts[0].length < 60) {
      detectedBusinessName = truncateString(parts[0], 80);
    }
  }

  // 2. Technical Extraction
  const viewportMatch = html.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i);
  const hasViewportMeta = Boolean(viewportMatch);
  const viewportContent = viewportMatch ? truncateString(viewportMatch[1], 100) : null;
  const isResponsive = Boolean(
    viewportMatch &&
      (viewportMatch[1].includes("width=device-width") ||
        viewportMatch[1].includes("initial-scale=1"))
  );

  const hasHeader = /<header[\s>]/i.test(html);
  const hasNav = /<nav[\s>]/i.test(html);
  const hasMain = /<main[\s>]/i.test(html);
  const hasFooter = /<footer[\s>]/i.test(html);
  const h1Matches = html.match(/<h1[\s>]/gi);
  const h1Count = h1Matches ? h1Matches.length : 0;

  // Accessibility: image alt tags
  const imgMatches = html.match(/<img\b[^>]*>/gi) || [];
  let imagesWithAlt = 0;
  let imagesWithoutAlt = 0;
  for (const imgTag of imgMatches) {
    if (/alt=["'][^"']*["']/i.test(imgTag)) {
      imagesWithAlt++;
    } else {
      imagesWithoutAlt++;
    }
  }

  // 3. Business & Contact Information (Public Explicit Data Only)
  const emailsSet = new Set<string>();
  const mailtoMatches = html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
  for (const match of mailtoMatches) {
    const email = match[1].toLowerCase().trim();
    if (!email.endsWith(".png") && !email.endsWith(".jpg") && !email.endsWith(".svg")) {
      emailsSet.add(email);
    }
  }
  // Public regex search for contact emails
  const rawEmailMatches = html.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi);
  for (const match of rawEmailMatches) {
    const email = match[1].toLowerCase().trim();
    const isAsset = /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email);
    if (!isAsset && emailsSet.size < 5) {
      emailsSet.add(email);
    }
  }
  const emails = Array.from(emailsSet).slice(0, 5);

  const phonesSet = new Set<string>();
  const telMatches = html.matchAll(/tel:([+0-9()-\s.]+)/gi);
  for (const match of telMatches) {
    const phone = match[1].replace(/[^\d+]/g, "").trim();
    if (phone.length >= 7 && phone.length <= 15) {
      phonesSet.add(match[1].trim());
    }
  }
  // Public regex search for standard phone numbers (e.g. (512) 555-0199 or +1-512-555-0199)
  const plainPhoneMatches = html.matchAll(/(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g);
  for (const match of plainPhoneMatches) {
    if (phonesSet.size < 5) {
      phonesSet.add(match[0].trim());
    }
  }
  const phones = Array.from(phonesSet).slice(0, 5);

  // Address
  const addresses: string[] = [];
  const addressMatch = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i);
  if (addressMatch) {
    const cleanAddr = addressMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (cleanAddr.length > 5) {
      addresses.push(truncateString(cleanAddr, 150)!);
    }
  }

  // Conversion & Booking signals
  const bookingLinks: string[] = [];
  const bookingPatterns = [
    /href=["'](https?:\/\/(?:www\.)?calendly\.com\/[^"']+)["']/gi,
    /href=["'](https?:\/\/(?:www\.)?cal\.com\/[^"']+)["']/gi,
    /href=["'](https?:\/\/[^"']*(?:acuityscheduling|tidycal|scheduleonce)[^"']*)["']/gi,
  ];
  for (const pattern of bookingPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      bookingLinks.push(truncateString(match[1], 150)!);
    }
  }
  const hasOnlineBooking =
    bookingLinks.length > 0 ||
    /data-calendly/i.test(html) ||
    /cal-embed/i.test(html);

  const hasEcommerce =
    /shopify/i.test(html) ||
    /woocommerce/i.test(html) ||
    /<a[^>]+href=["'][^"']*\/(cart|checkout|shop)["']/i.test(html);

  // Detected CTAs
  const ctaCandidates = [
    "Book a Call",
    "Schedule Consultation",
    "Get a Quote",
    "Contact Us",
    "Request Demo",
    "Start Free Trial",
    "Let's Talk",
    "Get Started",
  ];
  const detectedCtas: string[] = [];
  for (const cta of ctaCandidates) {
    const regex = new RegExp(`>\\s*${cta}\\s*<`, "i");
    if (regex.test(html)) {
      detectedCtas.push(cta);
    }
  }

  // Primary Nav Items
  const primaryNavItems: string[] = [];
  const navSection = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
  if (navSection) {
    const linkMatches = navSection[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi);
    for (const m of linkMatches) {
      const label = m[1].replace(/<[^>]+>/g, "").trim();
      if (label && label.length <= 25 && !primaryNavItems.includes(label)) {
        primaryNavItems.push(label);
      }
      if (primaryNavItems.length >= 6) break;
    }
  }

  // 4. Technology Detection (Confirmed Signals Only)
  const platforms: string[] = [];
  const generatorMatch = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  const generatorTag = generatorMatch ? truncateString(generatorMatch[1], 60) : null;

  if (generatorTag) {
    platforms.push(generatorTag);
  }
  if (/wp-content/i.test(html) && !platforms.includes("WordPress")) {
    platforms.push("WordPress");
  }
  if (/\bwebflow\.js\b/i.test(html) || /data-wf-page/i.test(html)) {
    if (!platforms.includes("Webflow")) platforms.push("Webflow");
  }
  if (/cdn\.shopify\.com/i.test(html) && !platforms.includes("Shopify")) {
    platforms.push("Shopify");
  }
  if (/squarespace-core/i.test(html) && !platforms.includes("Squarespace")) {
    platforms.push("Squarespace");
  }
  if (/_next\/static/i.test(html) && !platforms.includes("Next.js")) {
    platforms.push("Next.js");
  }
  if (/wix\.com/i.test(html) && !platforms.includes("Wix")) {
    platforms.push("Wix");
  }

  // 5. Social Links
  const extractSocial = (pattern: RegExp): string | null => {
    const m = html.match(pattern);
    return m ? truncateString(m[1], 150) : null;
  };

  const social = {
    linkedIn: extractSocial(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"']+)["']/i),
    instagram: extractSocial(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i),
    facebook: extractSocial(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/i),
    twitter: extractSocial(/href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i),
    github: extractSocial(/href=["'](https?:\/\/(?:www\.)?github\.com\/[^"']+)["']/i),
  };

  return {
    identity: {
      pageTitle,
      metaDescription,
      canonicalUrl,
      detectedBusinessName,
    },
    technical: {
      hasHttps: requestedUrl.startsWith("https://"),
      isFinalHttps,
      hasViewportMeta,
      viewportContent,
      isResponsive,
      semanticTags: {
        hasHeader,
        hasNav,
        hasMain,
        hasFooter,
        h1Count,
      },
      accessibility: {
        totalImages: imgMatches.length,
        imagesWithAlt,
        imagesWithoutAlt,
      },
    },
    business: {
      emails,
      phones,
      addresses,
      hasOnlineBooking,
      bookingLinks: bookingLinks.slice(0, 3),
      hasEcommerce,
      detectedCtas: detectedCtas.slice(0, 4),
      primaryNavItems: primaryNavItems.slice(0, 6),
    },
    technology: {
      detectedPlatforms: platforms.slice(0, 4),
      generatorTag,
    },
    social,
    researchedUrl: requestedUrl,
    finalUrl,
  };
}

/**
 * Bounds structured evidence payload to guaranteed safe JSON size limits
 * before persisting to PostgreSQL. Prevents unbounded JSON storage attacks.
 */
export function boundStructuredEvidence(evidence: StructuredEvidence): StructuredEvidence {
  return {
    ...evidence,
    identity: {
      pageTitle: truncateString(evidence.identity.pageTitle, 160),
      metaDescription: truncateString(evidence.identity.metaDescription, 300),
      canonicalUrl: truncateString(evidence.identity.canonicalUrl, 250),
      detectedBusinessName: truncateString(evidence.identity.detectedBusinessName, 80),
    },
    business: {
      ...evidence.business,
      emails: evidence.business.emails.slice(0, 5),
      phones: evidence.business.phones.slice(0, 5),
      addresses: evidence.business.addresses.slice(0, 2),
      bookingLinks: evidence.business.bookingLinks.slice(0, 3),
      detectedCtas: evidence.business.detectedCtas.slice(0, 4),
      primaryNavItems: evidence.business.primaryNavItems.slice(0, 6),
    },
    technology: {
      detectedPlatforms: evidence.technology.detectedPlatforms.slice(0, 4),
      generatorTag: truncateString(evidence.technology.generatorTag, 60),
    },
  };
}
