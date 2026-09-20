import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import {
  MockBusinessDiscoveryProvider,
  HunterDiscoverProvider,
  GooglePlacesProvider,
  GOOGLE_PLACES_FIELD_MASK,
  extractDomainFromUrl,
  formatPlaceType,
  parseAddressComponents,
  getBusinessDiscoveryProvider,
  mapHeadcountToHunter,
  DiscoveredBusiness,
} from "../src/lib/providers/business-discovery";
import { businessDiscoverySearchSchema } from "../src/lib/validation/business-discovery";
import { discoverBusinesses } from "../src/lib/services/business-discovery-service";
import {
  normalizeDiscoveredBusinessForCompany,
  areLocationsCompatible,
  persistDiscoveredBusinesses,
  findMatchingCompany,
  enrichCompany,
} from "../src/lib/services/business-persistence-service";
import { POST as discoverBusinessesRoute } from "../src/app/api/opportunities/discover/businesses/route";
import { POST as persistBusinessRoute } from "../src/app/api/opportunities/discover/businesses/persist/route";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long-for-jwt-signing";
const TENANT_A = "usr_biz_disc_tenant_a";
const TENANT_B = "usr_biz_disc_tenant_b";

let authCookieA: string;
let authCookieB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Phase B.1: Business Discovery Provider Foundation & Hunter Discover", () => {
  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    authCookieA = await createAuthCookie(TENANT_A, "tenant_a@bizdisc.dev", "Tenant A");
    authCookieB = await createAuthCookie(TENANT_B, "tenant_b@bizdisc.dev", "Tenant B");

    // Clean up test data if prior runs left residues
    await prisma.opportunity.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.aIResearch.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.lead.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.company.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });

    await prisma.user.createMany({
      data: [
        { id: TENANT_A, email: "tenant_a@bizdisc.dev", name: "Tenant A" },
        { id: TENANT_B, email: "tenant_b@bizdisc.dev", name: "Tenant B" },
      ],
    });
  });

  // =========================================================================
  // 1. PROVIDER ABSTRACTION & MOCK PROVIDER
  // =========================================================================

  it("1. MockBusinessDiscoveryProvider implements BusinessDiscoveryProvider interface", async () => {
    const provider = new MockBusinessDiscoveryProvider();
    assert.equal(provider.id, "mock-business-discovery");
    assert.ok(provider.name.includes("Mock"));
    assert.equal(provider.isConfigured(), true);

    const health = await provider.getHealth();
    assert.equal(health.status, "ok");
  });

  it("2. Mock provider returns normalized businesses with stable schema", async () => {
    const provider = new MockBusinessDiscoveryProvider();
    const result = await provider.discover({});

    assert.equal(result.isConfigured, true);
    assert.equal(result.isDevelopmentMock, true);
    assert.ok(result.businesses.length > 0);
    assert.ok(result.totalMatches >= result.businesses.length);

    const biz = result.businesses[0];
    assert.ok(biz.name);
    assert.equal(biz.source, "MOCK_SIMULATION");
    assert.ok("headquarters" in biz);
    assert.ok("technologies" in biz);
    assert.ok("keywords" in biz);
  });

  it("3. Mock provider includes businesses BOTH with and WITHOUT websites", async () => {
    const provider = new MockBusinessDiscoveryProvider();
    const result = await provider.discover({ limit: 50 });

    const withWebsite = result.businesses.filter((b) => Boolean(b.websiteUrl || b.domain));
    const withoutWebsite = result.businesses.filter((b) => !b.websiteUrl && !b.domain);

    assert.ok(
      withWebsite.length > 0,
      "Mock pool must include businesses WITH websites (for redesign/improvement discovery)"
    );
    assert.ok(
      withoutWebsite.length > 0,
      "Mock pool must include businesses WITHOUT websites (for NO_WEBSITE client acquisition)"
    );

    // Verify specific realistic no-website business
    const apexDental = withoutWebsite.find((b) => b.name.includes("Apex Peak Dental"));
    assert.ok(apexDental, "Apex Peak Dental must be present without website");
    assert.equal(apexDental.domain, undefined);
    assert.equal(apexDental.websiteUrl, undefined);
  });

  it("4. Mock provider filters by query, location, industry, and pagination", async () => {
    const provider = new MockBusinessDiscoveryProvider();

    // Query filter
    const dentalRes = await provider.discover({ query: "dental" });
    assert.ok(dentalRes.businesses.every((b) => b.name.toLowerCase().includes("dental") || b.industry?.toLowerCase().includes("dental")));

    // Location filter
    const portlandRes = await provider.discover({ location: "Portland" });
    assert.ok(portlandRes.businesses.every((b) => b.headquarters?.city?.toLowerCase() === "portland"));

    // Industry filter
    const softwareRes = await provider.discover({ industry: "software" });
    assert.ok(softwareRes.businesses.every((b) => b.industry?.toLowerCase().includes("software")));

    // Pagination
    const page1 = await provider.discover({ limit: 2, offset: 0 });
    const page2 = await provider.discover({ limit: 2, offset: 2 });
    assert.equal(page1.businesses.length, 2);
    assert.equal(page2.businesses.length, 2);
    assert.notEqual(page1.businesses[0].name, page2.businesses[0].name);
  });

  // =========================================================================
  // 2. HEADCOUNT MAPPING
  // =========================================================================

  it("5. mapHeadcountToHunter accurately translates ranges to official Hunter taxonomy", () => {
    // Exact bucket string
    assert.deepEqual(mapHeadcountToHunter("1-10"), ["1-10"]);
    assert.deepEqual(mapHeadcountToHunter("51-200"), ["51-200"]);

    // Range object spanning 1 to 50
    const smbRange = mapHeadcountToHunter({ min: 1, max: 50 });
    assert.deepEqual(smbRange, ["1-10", "11-50"]);

    // Mid-market range
    const midRange = mapHeadcountToHunter({ min: 50, max: 500 });
    assert.deepEqual(midRange, ["11-50", "51-200", "201-500"]);

    // Enterprise range
    const entRange = mapHeadcountToHunter({ min: 5001 });
    assert.deepEqual(entRange, ["5001-10000", "10001+"]);

    // Undefined / empty
    assert.deepEqual(mapHeadcountToHunter(undefined), []);
  });

  // =========================================================================
  // 3. HUNTER DISCOVER PROVIDER (MOCKED HTTP)
  // =========================================================================

  it("6. HunterDiscoverProvider reports unconfigured when key is missing", async () => {
    const provider = new HunterDiscoverProvider("");
    assert.equal(provider.isConfigured(), false);

    const result = await provider.discover({ query: "restaurants" });
    assert.equal(result.isConfigured, false);
    assert.equal(result.businesses.length, 0);
    assert.ok(result.message?.includes("not configured"));

    const health = await provider.getHealth();
    assert.equal(health.status, "unconfigured");
  });

  it("7. Hunter provider constructs correct POST /discover payload with headers and body filters", async () => {
    let capturedMethod = "";
    let capturedUrl = "";
    let capturedHeaders: Record<string, string | string[] | undefined> = {};
    let capturedBody: any = null;

    const mockServer = http.createServer((req, res) => {
      capturedMethod = req.method || "";
      capturedUrl = req.url || "";
      capturedHeaders = req.headers;

      let rawBody = "";
      req.on("data", (chunk) => (rawBody += chunk));
      req.on("end", () => {
        try {
          capturedBody = JSON.parse(rawBody);
        } catch {}

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                domain: "acmeweb.io",
                organization: "Acme Web Services",
                description: "Full service web development agency.",
                industry: "Information Technology",
                country: "IN",
                city: "Bengaluru",
                state: "Karnataka",
                headcount: "11-50",
                company_type: "private",
                year_founded: 2021,
                technologies: ["React", "Next.js", "Node.js"],
                keywords: ["web development", "react", "agency"],
                emails_count: {
                  personal: 5,
                  generic: 2,
                  total: 7,
                },
              },
            ],
            meta: {
              results: 1,
              limit: 25,
              offset: 5,
            },
          })
        );
      });
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new HunterDiscoverProvider("hunter_test_key_123", baseUrl);
      const result = await provider.discover({
        query: "web development agency",
        location: "India",
        industry: "Information Technology",
        keywords: ["react", "nextjs"],
        headcount: { min: 1, max: 50 },
        companyType: "private",
        limit: 25,
        offset: 5,
      });

      // Verify HTTP request
      assert.equal(capturedMethod, "POST");
      assert.equal(capturedUrl, "/discover");
      assert.equal(capturedHeaders["x-api-key"], "hunter_test_key_123");
      assert.equal(capturedHeaders["content-type"], "application/json");

      // Verify request body mapping
      assert.equal(capturedBody.query, "web development agency");
      assert.deepEqual(capturedBody.headquarters_location, {
        include: [{ country: "IN" }],
      });
      assert.deepEqual(capturedBody.industry, {
        include: ["Information Technology"],
      });
      assert.deepEqual(capturedBody.keywords, {
        include: ["react", "nextjs"],
        match: "any",
      });
      assert.deepEqual(capturedBody.headcount, ["1-10", "11-50"]);
      assert.deepEqual(capturedBody.company_type, {
        include: ["private"],
      });
      assert.equal(capturedBody.limit, 25);
      assert.equal(capturedBody.offset, 5);

      // Verify normalized result
      assert.equal(result.isConfigured, true);
      assert.equal(result.totalMatches, 1);
      assert.equal(result.businesses.length, 1);

      const biz = result.businesses[0];
      assert.equal(biz.name, "Acme Web Services");
      assert.equal(biz.domain, "acmeweb.io");
      assert.equal(biz.websiteUrl, "https://acmeweb.io");
      assert.equal(biz.industry, "Information Technology");
      assert.equal(biz.headquarters?.city, "Bengaluru");
      assert.equal(biz.headquarters?.country, "IN");
      assert.equal(biz.headcountRange, "11-50");
      assert.equal(biz.companyType, "private");
      assert.equal(biz.yearFounded, 2021);
      assert.deepEqual(biz.technologies, ["React", "Next.js", "Node.js"]);
      assert.deepEqual(biz.emailsCount, { personal: 5, generic: 2, total: 7 });
      assert.equal(biz.source, "HUNTER_DISCOVER");
      assert.ok(biz.sourceUrl?.includes("acmeweb.io"));
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  it("8. Hunter provider returns requirement guidance when no query or filters are supplied", async () => {
    const provider = new HunterDiscoverProvider("test_key");
    const result = await provider.discover({});

    assert.equal(result.isConfigured, true);
    assert.equal(result.businesses.length, 0);
    assert.equal(result.totalMatches, 0);
    assert.ok(result.message?.includes("requires a search query or at least one filter"));
  });

  it("9. Hunter provider converts 401/403 into clean authentication error without leaking API key", async () => {
    const mockServer = http.createServer((_req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ errors: [{ id: "unauthorized", details: "Invalid API key" }] }));
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new HunterDiscoverProvider("secret-sensitive-api-key-999", baseUrl);
      await assert.rejects(
        async () => {
          await provider.discover({ query: "restaurants" });
        },
        (err: Error) => {
          assert.ok(err.message.includes("authentication failed"));
          assert.ok(!err.message.includes("secret-sensitive-api-key-999"));
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  it("10. Hunter provider converts 429 rate limit into clean user-facing error", async () => {
    const mockServer = http.createServer((_req, res) => {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ errors: [{ details: "Rate limit reached" }] }));
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new HunterDiscoverProvider("test_key", baseUrl);
      await assert.rejects(
        async () => {
          await provider.discover({ query: "restaurants" });
        },
        (err: Error) => {
          assert.ok(err.message.includes("rate limit or search quota exceeded"));
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  it("11. Hunter provider handles malformed responses gracefully", async () => {
    const mockServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("THIS IS NOT JSON");
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new HunterDiscoverProvider("test_key", baseUrl);
      await assert.rejects(
        async () => {
          await provider.discover({ query: "software" });
        },
        (err: Error) => {
          assert.ok(err.message.includes("malformed"));
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  // =========================================================================
  // 4. SERVICE & VALIDATION LAYER
  // =========================================================================

  it("12. discoverBusinesses service validates schema and selects Mock provider in simulation mode", async () => {
    const origDevMode = process.env.DISCOVERY_DEV_MODE;
    try {
      process.env.DISCOVERY_DEV_MODE = "true";

      const result = await discoverBusinesses(TENANT_A, {
        query: "dental",
        limit: 5,
      });

      assert.equal(result.isDevelopmentMock, true);
      assert.ok(result.businesses.length > 0);
      assert.ok(result.businesses.length <= 5);
    } finally {
      process.env.DISCOVERY_DEV_MODE = origDevMode;
    }
  });

  it("13. businessDiscoverySearchSchema rejects invalid inputs and unauthorized extra fields", () => {
    // Valid input
    const valid = businessDiscoverySearchSchema.parse({
      query: "restaurants",
      location: "San Francisco",
      limit: 10,
    });
    assert.equal(valid.limit, 10);
    assert.equal(valid.offset, 0);

    // Negative offset
    assert.throws(() => {
      businessDiscoverySearchSchema.parse({ offset: -1 });
    });

    // Limit > 100
    assert.throws(() => {
      businessDiscoverySearchSchema.parse({ limit: 150 });
    });

    // Malicious or forbidden field injection
    assert.throws(() => {
      businessDiscoverySearchSchema.parse({
        query: "tech",
        userId: "override_tenant_victim",
      });
    });
  });

  it("14. BusinessDiscoveryService performs ZERO database writes", async () => {
    const initialCompanyCount = await prisma.company.count({ where: { userId: TENANT_A } });
    const initialOpportunityCount = await prisma.opportunity.count({ where: { userId: TENANT_A } });

    await discoverBusinesses(TENANT_A, {
      query: "dental",
      providerId: "mock",
    });

    const finalCompanyCount = await prisma.company.count({ where: { userId: TENANT_A } });
    const finalOpportunityCount = await prisma.opportunity.count({ where: { userId: TENANT_A } });

    assert.equal(finalCompanyCount, initialCompanyCount, "No companies should be written to DB during discovery");
    assert.equal(finalOpportunityCount, initialOpportunityCount, "No opportunities should be written to DB during discovery");
  });

  // =========================================================================
  // 5. API ROUTE: POST /api/opportunities/discover/businesses
  // =========================================================================

  it("15. POST /api/opportunities/discover/businesses rejects unauthenticated request (401)", async () => {
    const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "dentist" }),
    });

    const res = await discoverBusinessesRoute(req);
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.code, "AUTHENTICATION_REQUIRED");
  });

  it("16. POST /api/opportunities/discover/businesses succeeds with authenticated session", async () => {
    const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({
        query: "bakery",
        providerId: "mock",
        limit: 10,
      }),
    });

    const res = await discoverBusinessesRoute(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.isConfigured, true);
    assert.ok(Array.isArray(body.businesses));
    assert.ok(body.businesses.length > 0);
    assert.equal(body.businesses[0].name, "Oak & Ember Artisan Bakery");
  });

  it("17. POST /api/opportunities/discover/businesses rejects invalid JSON with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: "INVALID_NOT_JSON",
    });

    const res = await discoverBusinessesRoute(req);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.code, "VALIDATION_ERROR");
  });

  it("18. POST /api/opportunities/discover/businesses rejects oversized limit with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({
        query: "tech",
        limit: 500, // Exceeds 100 max
      }),
    });

    const res = await discoverBusinessesRoute(req);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.code, "VALIDATION_ERROR");
  });

  // =========================================================================
  // 6. GOOGLE PLACES PROVIDER (PHASE B.2 - MOCKED HTTP)
  // =========================================================================

  it("19. Google Places helpers: extractDomainFromUrl, formatPlaceType, parseAddressComponents", () => {
    // Domain extraction
    assert.equal(extractDomainFromUrl("https://www.cedarparkdental.com/services"), "cedarparkdental.com");
    assert.equal(extractDomainFromUrl("http://dentist.co.uk/about?q=1"), "dentist.co.uk");
    assert.equal(extractDomainFromUrl("https://sub.domain.org/path/"), "sub.domain.org");
    assert.equal(extractDomainFromUrl(undefined), undefined);
    assert.equal(extractDomainFromUrl(""), undefined);
    assert.equal(extractDomainFromUrl("   "), undefined);

    // Place type formatting
    assert.equal(formatPlaceType("dental_clinic"), "Dental Clinic");
    assert.equal(formatPlaceType("auto_repair"), "Auto Repair");
    assert.equal(formatPlaceType(undefined), undefined);

    // Address components parsing
    const parsedHq = parseAddressComponents(
      [
        { longText: "100", shortText: "100", types: ["street_number"] },
        { longText: "Congress Avenue", shortText: "Congress Ave", types: ["route"] },
        { longText: "Austin", shortText: "Austin", types: ["locality"] },
        { longText: "Texas", shortText: "TX", types: ["administrative_area_level_1"] },
        { longText: "United States", shortText: "US", types: ["country"] },
        { longText: "78701", shortText: "78701", types: ["postal_code"] },
      ],
      "100 Congress Ave, Austin, TX 78701, USA"
    );

    assert.ok(parsedHq);
    assert.equal(parsedHq.city, "Austin");
    assert.equal(parsedHq.state, "TX");
    assert.equal(parsedHq.country, "US");
    assert.equal(parsedHq.postalCode, "78701");
    assert.equal(parsedHq.streetAddress, "100 Congress Avenue");
    assert.equal(parsedHq.formattedAddress, "100 Congress Ave, Austin, TX 78701, USA");
  });

  it("20. GooglePlacesProvider reports unconfigured when key is missing", async () => {
    const provider = new GooglePlacesProvider("");
    assert.equal(provider.isConfigured(), false);

    const result = await provider.discover({ query: "dentist" });
    assert.equal(result.isConfigured, false);
    assert.equal(result.businesses.length, 0);
    assert.ok(result.message?.includes("not configured"));

    const health = await provider.getHealth();
    assert.equal(health.status, "unconfigured");
  });

  it("21. GooglePlacesProvider constructs correct POST /places:searchText request with headers and body", async () => {
    let capturedMethod = "";
    let capturedUrl = "";
    let capturedHeaders: Record<string, string | string[] | undefined> = {};
    let capturedBody: any = null;

    const mockServer = http.createServer((req, res) => {
      capturedMethod = req.method || "";
      capturedUrl = req.url || "";
      capturedHeaders = req.headers;

      let rawBody = "";
      req.on("data", (chunk) => (rawBody += chunk));
      req.on("end", () => {
        try {
          capturedBody = JSON.parse(rawBody);
        } catch {}

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            places: [
              {
                id: "places_test_001",
                displayName: { text: "Austin Dental Studio", languageCode: "en" },
                formattedAddress: "200 South Congress, Austin, TX 78704, USA",
                websiteUri: "https://austindentalstudio.com",
                nationalPhoneNumber: "(512) 555-0199",
                rating: 4.9,
                userRatingCount: 215,
                primaryType: "dentist",
                primaryTypeDisplayName: { text: "Dentist" },
                editorialSummary: { text: "Premier cosmetic and general dentistry clinic." },
                googleMapsUri: "https://maps.google.com/?cid=1001",
                addressComponents: [
                  { longText: "Austin", shortText: "Austin", types: ["locality"] },
                  { longText: "Texas", shortText: "TX", types: ["administrative_area_level_1"] },
                  { longText: "United States", shortText: "US", types: ["country"] },
                  { longText: "78704", shortText: "78704", types: ["postal_code"] },
                ],
              },
            ],
          })
        );
      });
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("google_test_key_xyz", baseUrl);
      const result = await provider.discover({
        query: "cosmetic dentist",
        location: "Austin, TX",
        limit: 15,
      });

      assert.equal(capturedMethod, "POST");
      assert.equal(capturedUrl, "/places:searchText");
      assert.equal(capturedHeaders["content-type"], "application/json");
      assert.equal(capturedHeaders["x-goog-api-key"], "google_test_key_xyz");
      assert.equal(capturedHeaders["x-goog-fieldmask"], GOOGLE_PLACES_FIELD_MASK);

      // Verify cost-optimized field mask: only core identification, address, category, website, and maps URI
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.id"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.displayName"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.formattedAddress"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.websiteUri"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.primaryType"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.primaryTypeDisplayName"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.types"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.addressComponents"));
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes("places.googleMapsUri"));

      // Verify that expensive Contact and Atmosphere SKUs are NOT requested in initial discovery
      assert.equal(GOOGLE_PLACES_FIELD_MASK.includes("places.nationalPhoneNumber"), false);
      assert.equal(GOOGLE_PLACES_FIELD_MASK.includes("places.internationalPhoneNumber"), false);
      assert.equal(GOOGLE_PLACES_FIELD_MASK.includes("places.rating"), false);
      assert.equal(GOOGLE_PLACES_FIELD_MASK.includes("places.userRatingCount"), false);
      assert.equal(GOOGLE_PLACES_FIELD_MASK.includes("places.editorialSummary"), false);

      assert.equal(capturedBody.textQuery, "cosmetic dentist in Austin, TX");
      assert.equal(capturedBody.pageSize, 15);

      assert.equal(result.isConfigured, true);
      assert.equal(result.businesses.length, 1);
      assert.equal(result.businesses[0].name, "Austin Dental Studio");
    } finally {
      mockServer.close();
    }
  });

  it("22. GooglePlacesProvider query construction logic (query, industry, keywords, location fallback)", async () => {
    let lastQuery = "";

    const mockServer = http.createServer((req, res) => {
      let rawBody = "";
      req.on("data", (chunk) => (rawBody += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(rawBody);
          lastQuery = parsed.textQuery;
        } catch {}
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ places: [] }));
      });
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("google_key", baseUrl);

      // Query already containing location
      await provider.discover({ query: "Plumber in Dallas", location: "Dallas" });
      assert.equal(lastQuery, "Plumber in Dallas");

      // Query + location
      await provider.discover({ query: "Auto Repair", location: "Cleveland, OH" });
      assert.equal(lastQuery, "Auto Repair in Cleveland, OH");

      // Industry fallback
      await provider.discover({ industry: "Veterinary Clinic", location: "Seattle" });
      assert.equal(lastQuery, "Veterinary Clinic in Seattle");

      // Keywords fallback
      await provider.discover({ keywords: ["hvac", "ac repair"], location: "Phoenix" });
      assert.equal(lastQuery, "hvac ac repair in Phoenix");

      // Location alone
      await provider.discover({ location: "Portland, OR" });
      assert.equal(lastQuery, "Portland, OR");

      // Empty query and location: should return message without sending HTTP request
      lastQuery = "UNTOUCHED";
      const emptyRes = await provider.discover({});
      assert.equal(lastQuery, "UNTOUCHED");
      assert.equal(emptyRes.businesses.length, 0);
      assert.ok(emptyRes.message?.includes("requires a query"));
    } finally {
      mockServer.close();
    }
  });

  it("23. Response normalization: business with complete details and websiteUri", async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          places: [
            {
              id: "place_complete_001",
              displayName: { text: "Apex Precision Dental", languageCode: "en" },
              formattedAddress: "500 Main St, Austin, TX 78701, USA",
              websiteUri: "https://www.apexprecisiondental.com/services?ref=google",
              nationalPhoneNumber: "(512) 555-4321",
              rating: 4.8,
              userRatingCount: 89,
              primaryType: "dentist",
              primaryTypeDisplayName: { text: "Dental Clinic" },
              types: ["dentist", "health", "point_of_interest"],
              editorialSummary: { text: "Specialized in cosmetic porcelain veneers and implants." },
              googleMapsUri: "https://maps.google.com/?cid=9999",
              addressComponents: [
                { longText: "Austin", shortText: "Austin", types: ["locality"] },
                { longText: "Texas", shortText: "TX", types: ["administrative_area_level_1"] },
                { longText: "United States", shortText: "US", types: ["country"] },
                { longText: "78701", shortText: "78701", types: ["postal_code"] },
              ],
            },
          ],
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("google_key", baseUrl);
      const res = await provider.discover({ query: "Apex Dental" });

      assert.equal(res.businesses.length, 1);
      const biz = res.businesses[0];

      assert.equal(biz.name, "Apex Precision Dental");
      assert.equal(biz.externalId, "place_complete_001");
      assert.equal(biz.websiteUrl, "https://www.apexprecisiondental.com/services?ref=google");
      assert.equal(biz.domain, "apexprecisiondental.com");
      assert.equal(biz.industry, "Dental Clinic");
      assert.equal(biz.description, "Specialized in cosmetic porcelain veneers and implants.");
      assert.equal(biz.phoneNumber, "(512) 555-4321");
      assert.equal(biz.rating, 4.8);
      assert.equal(biz.userRatingCount, 89);
      assert.equal(biz.primaryType, "dentist");
      assert.equal(biz.source, "GOOGLE_PLACES");
      assert.equal(biz.sourceUrl, "https://maps.google.com/?cid=9999");
      assert.equal(biz.headquarters?.city, "Austin");
      assert.equal(biz.headquarters?.state, "TX");
      assert.equal(biz.headquarters?.country, "US");
      assert.equal(biz.headquarters?.postalCode, "78701");
      assert.equal(biz.headquarters?.formattedAddress, "500 Main St, Austin, TX 78701, USA");
    } finally {
      mockServer.close();
    }
  });

  it("24. CRITICAL SEMANTIC TEST: Business WITHOUT websiteUri normalizes to websiteUrl === undefined", async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          places: [
            {
              id: "place_no_web_001",
              displayName: { text: "Bob's Old School Barber Shop" },
              formattedAddress: "123 Elm St, Austin, TX 78702, USA",
              // websiteUri is completely absent/undefined in Google's response!
              nationalPhoneNumber: "(512) 555-8888",
              rating: 4.7,
              userRatingCount: 42,
              primaryType: "barber_shop",
              primaryTypeDisplayName: { text: "Barber Shop" },
              googleMapsUri: "https://maps.google.com/?cid=7777",
            },
          ],
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("google_key", baseUrl);
      const res = await provider.discover({ query: "Bob's Barber" });

      assert.equal(res.businesses.length, 1);
      const biz = res.businesses[0];

      // Critical Assertions
      assert.equal(biz.name, "Bob's Old School Barber Shop");
      assert.equal(biz.websiteUrl, undefined, "websiteUrl must be strictly undefined when absent in Google response");
      assert.equal(biz.domain, undefined, "domain must be strictly undefined when websiteUrl is absent");
      assert.notEqual(biz.websiteUrl, "bobsoldschoolbarbershop.com", "Must NEVER fabricate website URL from business name");
      assert.equal(biz.source, "GOOGLE_PLACES");
    } finally {
      mockServer.close();
    }
  });

  it("25. Error handling: 400 Bad Request with sanitized message", async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            code: 400,
            message: "FieldMask is invalid: places.unsupportedField",
            status: "INVALID_ARGUMENT",
          },
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("google_key", baseUrl);
      await assert.rejects(
        async () => provider.discover({ query: "bakery" }),
        (err: Error) => {
          assert.ok(err.message.includes("FieldMask is invalid"));
          return true;
        }
      );
    } finally {
      mockServer.close();
    }
  });

  it("26. Error handling: 401/403 Authentication / Access Denied", async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            code: 403,
            message: "API key not valid. Please pass a valid API key.",
            status: "PERMISSION_DENIED",
          },
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("invalid_key", baseUrl);
      await assert.rejects(
        async () => provider.discover({ query: "bakery" }),
        (err: Error) => {
          assert.ok(err.message.includes("Google Places access denied"));
          return true;
        }
      );
    } finally {
      mockServer.close();
    }
  });

  it("27. Error handling: 429 Rate Limit / Quota Exceeded", async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            code: 429,
            message: "Resource has been exhausted (e.g. check quota).",
            status: "RESOURCE_EXHAUSTED",
          },
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("google_key", baseUrl);
      await assert.rejects(
        async () => provider.discover({ query: "bakery" }),
        (err: Error) => {
          assert.ok(err.message.includes("rate limit exceeded or quota exhausted"));
          return true;
        }
      );
    } finally {
      mockServer.close();
    }
  });

  it("28. Error handling: 503 Transient error retries and succeeds on subsequent attempt", async () => {
    let callCount = 0;

    const mockServer = http.createServer((req, res) => {
      callCount++;
      if (callCount === 1) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Service Unavailable" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          places: [{ id: "retry_biz", displayName: { text: "Recovered Bakery" } }],
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider("google_key", baseUrl);
      const res = await provider.discover({ query: "bakery" });

      assert.equal(callCount, 2, "Must retry once on 503 transient error");
      assert.equal(res.businesses.length, 1);
      assert.equal(res.businesses[0].name, "Recovered Bakery");
    } finally {
      mockServer.close();
    }
  });

  it("29. Security: API key is never leaked in errors", async () => {
    const SECRET_KEY = "super_secret_google_key_99999";

    const mockServer = http.createServer((req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      // Upstream accidentally echoes the secret key in message
      res.end(
        JSON.stringify({
          error: {
            code: 400,
            message: `Invalid key format for key ${SECRET_KEY} in request`,
          },
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const provider = new GooglePlacesProvider(SECRET_KEY, baseUrl);
      await assert.rejects(
        async () => provider.discover({ query: "bakery" }),
        (err: Error) => {
          assert.equal(err.message.includes(SECRET_KEY), false, "API key must never appear in thrown error");
          assert.ok(err.message.includes("[REDACTED]"), "API key must be replaced with [REDACTED]");
          return true;
        }
      );
    } finally {
      mockServer.close();
    }
  });

  it("30. Provider factory selects GooglePlacesProvider for 'google-places' and 'google'", () => {
    const googlePlaces = getBusinessDiscoveryProvider("google-places");
    assert.equal(googlePlaces.id, "google-places");
    assert.equal(googlePlaces.name, "Google Places (New)");

    const googleShort = getBusinessDiscoveryProvider("google");
    assert.equal(googleShort.id, "google-places");

    const hunter = getBusinessDiscoveryProvider("hunter");
    assert.equal(hunter.id, "hunter-discover");

    const mock = getBusinessDiscoveryProvider("mock");
    assert.equal(mock.id, "mock-business-discovery");
  });

  it("31. POST /api/opportunities/discover/businesses succeeds with providerId: 'google-places'", async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          places: [
            {
              id: "place_api_route_001",
              displayName: { text: "Downtown Austin Optometry" },
              formattedAddress: "800 Colorado St, Austin, TX 78701, USA",
              websiteUri: "https://downtownaustinoptometry.com",
              primaryType: "optometrist",
              primaryTypeDisplayName: { text: "Optometrist" },
            },
          ],
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const originalBaseUrl = process.env.GOOGLE_PLACES_BASE_URL;
    const originalKey = process.env.GOOGLE_PLACES_API_KEY;

    process.env.GOOGLE_PLACES_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.GOOGLE_PLACES_API_KEY = "test_google_key";

    try {
      const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookieA,
        },
        body: JSON.stringify({
          query: "optometrist",
          location: "Austin, TX",
          providerId: "google-places",
          limit: 10,
        }),
      });

      const res = await discoverBusinessesRoute(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.isConfigured, true);
      assert.equal(body.providerName, "Google Places (New)");
      assert.equal(body.businesses.length, 1);
      assert.equal(body.businesses[0].name, "Downtown Austin Optometry");
      assert.equal(body.businesses[0].source, "GOOGLE_PLACES");
    } finally {
      mockServer.close();
      process.env.GOOGLE_PLACES_BASE_URL = originalBaseUrl;
      process.env.GOOGLE_PLACES_API_KEY = originalKey;
    }
  });

  it("32. Google Places discovery performs ZERO database writes", async () => {
    const initialCompanyCount = await prisma.company.count({ where: { userId: TENANT_A } });
    const initialOpportunityCount = await prisma.opportunity.count({ where: { userId: TENANT_A } });

    const mockServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          places: [
            {
              id: "zero_write_place",
              displayName: { text: "Zero Write Plumbing" },
            },
          ],
        })
      );
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const originalBaseUrl = process.env.GOOGLE_PLACES_BASE_URL;
    const originalKey = process.env.GOOGLE_PLACES_API_KEY;

    process.env.GOOGLE_PLACES_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.GOOGLE_PLACES_API_KEY = "test_google_key";

    try {
      await discoverBusinesses(TENANT_A, {
        query: "plumber",
        providerId: "google-places",
      });

      const finalCompanyCount = await prisma.company.count({ where: { userId: TENANT_A } });
      const finalOpportunityCount = await prisma.opportunity.count({ where: { userId: TENANT_A } });

      assert.equal(finalCompanyCount, initialCompanyCount, "No companies should be written to DB during Google Places discovery");
      assert.equal(finalOpportunityCount, initialOpportunityCount, "No opportunities should be written to DB during Google Places discovery");
    } finally {
      mockServer.close();
      process.env.GOOGLE_PLACES_BASE_URL = originalBaseUrl;
      process.env.GOOGLE_PLACES_API_KEY = originalKey;
    }
  });

  // =========================================================================
  // 7. PHASE B.3: PERSIST DISCOVERED BUSINESSES & COMPANY DEDUPLICATION
  // =========================================================================

  it("68. normalizeDiscoveredBusinessForCompany correctly canonicalizes all fields and never fabricates URLs", () => {
    const rawWithWebsite: DiscoveredBusiness = {
      name: "  Acme Cloud Dynamics Inc  ",
      websiteUrl: "https://WWW.AcmeCloud.io/about?ref=hunter",
      domain: "AcmeCloud.io",
      industry: "Cloud Infrastructure",
      description: "Scalable Kubernetes platform",
      headquarters: {
        formattedAddress: "100 Tech Blvd, Suite 200, Austin, TX 78701, USA",
        city: "Austin",
        state: "TX",
        country: "USA",
      },
      headcountRange: "51-200",
      source: "HUNTER_DISCOVER",
    };

    const norm1 = normalizeDiscoveredBusinessForCompany(rawWithWebsite);
    assert.equal(norm1.name, "Acme Cloud Dynamics Inc");
    assert.equal(norm1.domain, "acmecloud.io");
    assert.equal(norm1.website, "https://WWW.AcmeCloud.io/about?ref=hunter");
    assert.equal(norm1.industry, "Cloud Infrastructure");
    assert.equal(norm1.companySize, "51-200");
    assert.equal(norm1.location, "100 Tech Blvd, Suite 200, Austin, TX 78701, USA");
    assert.equal(norm1.description, "Scalable Kubernetes platform");

    // Local business with NO website and NO domain (Google Places scenario)
    const rawNoWebsite: DiscoveredBusiness = {
      name: "Joe's Local Garage",
      industry: "Auto Repair",
      headquarters: {
        city: "Boulder",
        state: "CO",
        country: "USA",
      },
      employeeCount: 6,
      source: "GOOGLE_PLACES",
    };

    const norm2 = normalizeDiscoveredBusinessForCompany(rawNoWebsite);
    assert.equal(norm2.name, "Joe's Local Garage");
    assert.equal(norm2.domain, null, "Domain must remain null when websiteUrl is undefined");
    assert.equal(norm2.website, null, "Website must remain null when websiteUrl is undefined");
    assert.equal(norm2.industry, "Auto Repair");
    assert.equal(norm2.companySize, "6");
    assert.equal(norm2.location, "Boulder, CO, USA");
  });

  it("69. areLocationsCompatible distinguishes compatible vs conflicting locations", () => {
    assert.equal(areLocationsCompatible("Austin, TX, USA", "Austin, TX"), true);
    assert.equal(areLocationsCompatible("San Francisco, CA", "San Francisco"), true);
    assert.equal(areLocationsCompatible(null, "Austin, TX"), true);
    assert.equal(areLocationsCompatible("Austin, TX", null), true);
    assert.equal(areLocationsCompatible("Austin, TX", "Seattle, WA"), false);
    assert.equal(areLocationsCompatible("Denver, Colorado, USA", "Miami, FL, USA"), false);
  });

  it("70. New discovered business creates Company owned by session user without creating Leads or Opportunities", async () => {
    const business: DiscoveredBusiness = {
      name: "Lone Star Web Forge",
      websiteUrl: "https://lonestarwebforge.dev",
      domain: "lonestarwebforge.dev",
      industry: "Web Development",
      headquarters: {
        formattedAddress: "401 Congress Ave, Austin, TX 78701",
      },
      source: "MOCK_SIMULATION",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [business]);

    assert.equal(result.total, 1);
    assert.equal(result.created, 1);
    assert.equal(result.updated, 0);
    assert.equal(result.companies.length, 1);
    assert.equal(result.companies[0].action, "created");
    assert.equal(result.companies[0].domain, "lonestarwebforge.dev");

    // Verify company in DB
    const inDb = await prisma.company.findUnique({
      where: { id: result.companies[0].id },
    });
    assert.ok(inDb, "Company record must exist in DB");
    assert.equal(inDb.userId, TENANT_A, "Company must be strictly owned by session user");
    assert.equal(inDb.name, "Lone Star Web Forge");
    assert.equal(inDb.domain, "lonestarwebforge.dev");
    assert.equal(inDb.location, "401 Congress Ave, Austin, TX 78701");

    // CRITICAL HARD BOUNDARY CHECK: Zero Lead, Opportunity, or AIResearch records
    const leadCount = await prisma.lead.count({ where: { userId: TENANT_A } });
    const oppCount = await prisma.opportunity.count({ where: { userId: TENANT_A } });
    const aiCount = await prisma.aIResearch.count({ where: { userId: TENANT_A } });

    assert.equal(leadCount, 0, "Phase B.3 must NOT create Lead records");
    assert.equal(oppCount, 0, "Phase B.3 must NOT create Opportunity records");
    assert.equal(aiCount, 0, "Phase B.3 must NOT create AIResearch records");
  });

  it("71. Matching by domain: existing Company by domain is reused and enriched", async () => {
    // Initial company exists for TENANT_A
    const initial = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "CloudScale Systems",
        domain: "cloudscale.io",
        website: "https://cloudscale.io",
        location: null,
        industry: null,
      },
    });

    // Discovered business with same normalized domain but slightly different casing / name
    const discovered: DiscoveredBusiness = {
      name: "CloudScale Systems Inc",
      domain: "CloudScale.io",
      websiteUrl: "https://cloudscale.io/products",
      industry: "DevOps",
      headquarters: {
        formattedAddress: "Seattle, WA, USA",
      },
      source: "HUNTER_DISCOVER",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [discovered]);

    assert.equal(result.total, 1);
    assert.equal(result.created, 0);
    assert.equal(result.updated, 1);
    assert.equal(result.companies[0].id, initial.id, "Must reuse existing Company ID");
    assert.equal(result.companies[0].action, "updated");

    // Verify DB record enriched safely
    const updatedInDb = await prisma.company.findUnique({
      where: { id: initial.id },
    });
    assert.ok(updatedInDb);
    assert.equal(updatedInDb.name, "CloudScale Systems", "Original company name preserved");
    assert.equal(updatedInDb.industry, "DevOps", "Missing industry enriched");
    assert.equal(updatedInDb.location, "Seattle, WA, USA", "Missing location enriched");
  });

  it("72. Tenant isolation: same domain belonging to Tenant B is NOT matched or reused by Tenant A", async () => {
    // Tenant B creates a company
    const companyB = await prisma.company.create({
      data: {
        userId: TENANT_B,
        name: "Apex Cyber",
        domain: "apexcyber.com",
        website: "https://apexcyber.com",
        industry: "Cybersecurity",
      },
    });

    // Tenant A discovers business with the exact same domain
    const discoveredForA: DiscoveredBusiness = {
      name: "Apex Cyber",
      domain: "apexcyber.com",
      websiteUrl: "https://apexcyber.com",
      industry: "Security",
      source: "HUNTER_DISCOVER",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [discoveredForA]);

    assert.equal(result.created, 1, "Tenant A must create their own Company record");
    assert.notEqual(result.companies[0].id, companyB.id, "Tenant A must not hijack Tenant B company ID");

    // Verify Tenant B's record is completely untouched
    const untouchedB = await prisma.company.findUnique({
      where: { id: companyB.id },
    });
    assert.ok(untouchedB);
    assert.equal(untouchedB.userId, TENANT_B);
    assert.equal(untouchedB.industry, "Cybersecurity", "Tenant B data must remain untouched");
  });

  it("73. Missing domain business matches existing Company by name and compatible location", async () => {
    const existingNoWeb = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Austin Dental Oasis",
        domain: null,
        website: null,
        location: "Austin, TX",
        industry: "Dental",
      },
    });

    const discoveredNoWeb: DiscoveredBusiness = {
      name: "Austin Dental Oasis",
      headquarters: {
        formattedAddress: "Austin, TX, USA",
      },
      headcountRange: "1-10",
      source: "GOOGLE_PLACES",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [discoveredNoWeb]);

    assert.equal(result.created, 0);
    assert.equal(result.updated, 1);
    assert.equal(result.companies[0].id, existingNoWeb.id, "Must match existing company by name & location");

    const enriched = await prisma.company.findUnique({
      where: { id: existingNoWeb.id },
    });
    assert.equal(enriched?.companySize, "1-10", "Company size should be enriched");
    assert.equal(enriched?.domain, null, "Domain must remain null");
  });

  it("74. Same-name businesses in conflicting locations safely disambiguate name to avoid P2002 collision", async () => {
    const existingCafe = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Blue Moon Cafe",
        domain: null,
        location: "Portland, OR",
      },
    });

    // Another cafe with the exact same name in Austin, TX
    const conflictingCafe: DiscoveredBusiness = {
      name: "Blue Moon Cafe",
      headquarters: {
        formattedAddress: "Austin, TX, USA",
      },
      source: "GOOGLE_PLACES",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [conflictingCafe]);

    assert.equal(result.created, 1, "Should create a distinct company for conflicting location");
    assert.notEqual(result.companies[0].id, existingCafe.id);
    assert.ok(
      result.companies[0].name.startsWith("Blue Moon Cafe"),
      "Name should be safely disambiguated"
    );

    // Verify both companies exist in DB without error
    const count = await prisma.company.count({
      where: {
        userId: TENANT_A,
        name: { startsWith: "Blue Moon Cafe" },
      },
    });
    assert.equal(count, 2, "Both cafe branches should exist under user account");
  });

  it("75. Safe enrichment: undefined or null discovery fields do NOT erase existing non-null data", async () => {
    const preciousCompany = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Precision Machine Works",
        domain: "precision-machine.com",
        website: "https://precision-machine.com",
        industry: "Advanced Manufacturing",
        companySize: "100-250",
        location: "Detroit, MI",
        description: "Manually vetted high-value prospect with legacy website",
      },
    });

    // Discovered payload with missing/empty fields
    const minimalDiscovery: DiscoveredBusiness = {
      name: "Precision Machine Works",
      domain: "precision-machine.com",
      source: "HUNTER_DISCOVER",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [minimalDiscovery]);

    assert.equal(result.companies[0].id, preciousCompany.id);
    assert.equal(result.companies[0].action, "matched");

    const afterDb = await prisma.company.findUnique({
      where: { id: preciousCompany.id },
    });
    assert.ok(afterDb);
    assert.equal(afterDb.industry, "Advanced Manufacturing");
    assert.equal(afterDb.companySize, "100-250");
    assert.equal(afterDb.location, "Detroit, MI");
    assert.equal(afterDb.description, "Manually vetted high-value prospect with legacy website");
  });

  it("76. Idempotency: persisting the same discovery batch twice produces 0 duplicates", async () => {
    const batch: DiscoveredBusiness[] = [
      {
        name: "Idempotent Design Studio",
        domain: "idempotent-design.com",
        source: "MOCK_SIMULATION",
      },
      {
        name: "Idempotent Coffee Roasters",
        domain: "idempotent-coffee.org",
        source: "MOCK_SIMULATION",
      },
    ];

    const initialCompanyCount = await prisma.company.count({ where: { userId: TENANT_A } });

    // First persistence run
    const run1 = await persistDiscoveredBusinesses(TENANT_A, batch);
    assert.equal(run1.created, 2);

    const countAfterRun1 = await prisma.company.count({ where: { userId: TENANT_A } });
    assert.equal(countAfterRun1, initialCompanyCount + 2);

    // Second persistence run with exact same data
    const run2 = await persistDiscoveredBusinesses(TENANT_A, batch);
    assert.equal(run2.created, 0, "Second run must not create any new companies");

    const countAfterRun2 = await prisma.company.count({ where: { userId: TENANT_A } });
    assert.equal(countAfterRun2, countAfterRun1, "Company count must remain identical");
  });

  it("77. Google Places: business without website persists with domain: null and preserves place identity", async () => {
    const placesBusiness: DiscoveredBusiness = {
      externalId: "places_local_plumber_445",
      name: "Quick Fix Local Plumbing",
      industry: "Plumbing",
      headquarters: {
        formattedAddress: "888 Waterway Dr, Austin, TX 78704, USA",
        city: "Austin",
        state: "TX",
        country: "USA",
      },
      rating: 4.8,
      userRatingCount: 52,
      primaryType: "plumber",
      source: "GOOGLE_PLACES",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [placesBusiness]);

    assert.equal(result.created, 1);
    const company = await prisma.company.findUnique({
      where: { id: result.companies[0].id },
    });
    assert.ok(company);
    assert.equal(company.domain, null, "Domain must be null");
    assert.equal(company.website, null, "Website must be null");
    assert.equal(company.location, "888 Waterway Dr, Austin, TX 78704, USA");
    assert.notEqual(company.id, "places_local_plumber_445", "Google Place ID is NOT used as primary Company ID");
  });

  it("78. API Route: unauthenticated POST /api/opportunities/discover/businesses with persist: true is rejected (401)", async () => {
    const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "dentist", persist: true }),
    });

    const res = await discoverBusinessesRoute(req, { params: {} });
    assert.equal(res.status, 401);
  });

  it("79. API Route: invalid persist parameter and forbidden mass assignment fields are rejected (400)", async () => {
    // Non-boolean persist
    const req1 = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({ query: "dentist", persist: "yes_please" }),
    });

    const res1 = await discoverBusinessesRoute(req1, { params: {} });
    assert.equal(res1.status, 400);

    // Client-supplied userId forbidden
    const req2 = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({ query: "dentist", persist: true, userId: "hacked_tenant" }),
    });

    const res2 = await discoverBusinessesRoute(req2, { params: {} });
    assert.equal(res2.status, 400);
  });

  it("80. API Route: persist: false performs zero DB writes and omits persisted block", async () => {
    const beforeCount = await prisma.company.count({ where: { userId: TENANT_A } });

    const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({
        query: "dental",
        providerId: "mock",
        limit: 5,
        persist: false,
      }),
    });

    const res = await discoverBusinessesRoute(req, { params: {} });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.businesses.length > 0);
    assert.equal(data.persisted, undefined, "persisted summary should be omitted when persist is false");

    const afterCount = await prisma.company.count({ where: { userId: TENANT_A } });
    assert.equal(afterCount, beforeCount, "Must perform ZERO database writes when persist is false");
  });

  it("81. API Route: persist: true persists discovered companies scoped exclusively to session tenant", async () => {
    const beforeCountA = await prisma.company.count({ where: { userId: TENANT_A } });
    const beforeCountB = await prisma.company.count({ where: { userId: TENANT_B } });

    const req = new NextRequest("http://localhost:3000/api/opportunities/discover/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({
        query: "bakery",
        providerId: "mock",
        limit: 3,
        persist: true,
      }),
    });

    const res = await discoverBusinessesRoute(req, { params: {} });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.businesses.length > 0);
    assert.ok(data.persisted, "persisted summary must be present when persist is true");
    assert.equal(data.persisted.total, data.businesses.length);
    assert.equal(data.persisted.persistedCount, data.persisted.companies.length);
    assert.equal(data.persisted.failed, 0);
    assert.ok(data.persisted.companies.length > 0);

    const afterCountA = await prisma.company.count({ where: { userId: TENANT_A } });
    const afterCountB = await prisma.company.count({ where: { userId: TENANT_B } });

    assert.ok(afterCountA > beforeCountA, "Companies must be persisted for Tenant A");
    assert.equal(afterCountB, beforeCountB, "Zero companies must be persisted for Tenant B");

    // Verify zero Opportunity or Lead records
    const oppCountA = await prisma.opportunity.count({ where: { userId: TENANT_A } });
    const leadCountA = await prisma.lead.count({ where: { userId: TENANT_A } });
    assert.equal(oppCountA, 0, "No opportunities must be created");
    assert.equal(leadCountA, 0, "No leads must be created");
  });

  it("82. Partial persistence resilience: failure on one record persists valid records and records failed count without leaking internals", async () => {
    const valid1: DiscoveredBusiness = {
      name: "Resilient Alpha Studio",
      domain: "resilient-alpha.dev",
      source: "MOCK_SIMULATION",
    };

    const faultyBusiness: DiscoveredBusiness = {
      get name(): string {
        throw new Error("Simulated serialization/database fault for business 2");
      },
      source: "MOCK_SIMULATION",
    } as unknown as DiscoveredBusiness;

    const valid2: DiscoveredBusiness = {
      name: "Resilient Beta Analytics",
      domain: "resilient-beta.io",
      source: "MOCK_SIMULATION",
    };

    const result = await persistDiscoveredBusinesses(TENANT_A, [valid1, faultyBusiness, valid2]);

    assert.equal(result.total, 3, "Total should count all 3 candidates");
    assert.equal(result.persistedCount, 2, "persistedCount should reflect only successful records");
    assert.equal(result.created, 2, "Both valid businesses should be created");
    assert.equal(result.failed, 1, "Failed count should equal 1");
    assert.equal(result.companies.length, 2, "Companies array contains only successfully persisted records");

    // Verify both valid companies exist in DB
    const inDb1 = await prisma.company.findFirst({ where: { userId: TENANT_A, domain: "resilient-alpha.dev" } });
    const inDb2 = await prisma.company.findFirst({ where: { userId: TENANT_A, domain: "resilient-beta.io" } });
    assert.ok(inDb1, "Valid record 1 must be committed to DB");
    assert.ok(inDb2, "Valid record 2 must be committed to DB");
  });

  after(async () => {
    await prisma.opportunity.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.aIResearch.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.lead.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.company.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  });
});

// =============================================================================
// B.5A REGRESSION SUITE: Direct-Persist Endpoint & Provider Selection
// =============================================================================

describe("Phase B.5A: Direct-Persist Endpoint & Provider Selection Regressions", () => {
  const PERSIST_TENANT_A = "usr_b5a_persist_tenant_a";
  const PERSIST_TENANT_B = "usr_b5a_persist_tenant_b";

  let cookieA: string;
  let cookieB: string;

  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    cookieA = await createAuthCookie(
      PERSIST_TENANT_A,
      "a@b5a.dev",
      "B5A Tenant A"
    );
    cookieB = await createAuthCookie(
      PERSIST_TENANT_B,
      "b@b5a.dev",
      "B5A Tenant B"
    );

    await prisma.opportunity.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.aIResearch.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.lead.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.company.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });

    await prisma.user.createMany({
      data: [
        { id: PERSIST_TENANT_A, email: "a@b5a.dev", name: "B5A Tenant A" },
        { id: PERSIST_TENANT_B, email: "b@b5a.dev", name: "B5A Tenant B" },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // 83. Unauthenticated request is rejected
  // ---------------------------------------------------------------------------

  it("83. POST /persist rejects unauthenticated request with 401", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses/persist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost Corp", source: "GOOGLE_PLACES" }),
      }
    );

    const res = await persistBusinessRoute(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "AUTHENTICATION_REQUIRED");
  });

  // ---------------------------------------------------------------------------
  // 84. Invalid / forbidden fields are rejected
  // ---------------------------------------------------------------------------

  it("84. POST /persist rejects forbidden fields and missing source with 400", async () => {
    // Missing required `source`
    const req1 = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses/persist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({ name: "No Source Corp" }),
      }
    );
    const res1 = await persistBusinessRoute(req1);
    assert.equal(res1.status, 400);
    const b1 = await res1.json();
    assert.equal(b1.code, "VALIDATION_ERROR");

    // Forbidden extra field (strict mode)
    const req2 = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses/persist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          name: "Injection Corp",
          source: "GOOGLE_PLACES",
          userId: "other_tenant_victim",
        }),
      }
    );
    const res2 = await persistBusinessRoute(req2);
    assert.equal(res2.status, 400);
    const b2 = await res2.json();
    assert.equal(b2.code, "VALIDATION_ERROR");
  });

  // ---------------------------------------------------------------------------
  // 85. Individual persist preserves exact discovered business metadata
  // ---------------------------------------------------------------------------

  it("85. POST /persist persists exact DiscoveredBusiness metadata without re-searching", async () => {
    const business: DiscoveredBusiness = {
      externalId: "places_b5a_001",
      name: "Riverside Auto Detailing",
      domain: "riversideautodetailing.com",
      websiteUrl: "https://riversideautodetailing.com",
      industry: "Auto Detailing",
      description: "Premium mobile auto detailing service.",
      headquarters: {
        formattedAddress: "321 River Rd, Austin, TX 78704, USA",
        city: "Austin",
        state: "TX",
        country: "US",
      },
      headcountRange: "1-10",
      rating: 4.9,
      userRatingCount: 88,
      primaryType: "car_wash",
      source: "GOOGLE_PLACES",
      sourceUrl: "https://maps.google.com/?cid=b5a001",
    };

    const req = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses/persist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify(business),
      }
    );

    const res = await persistBusinessRoute(req);
    assert.equal(res.status, 200);

    const result = await res.json();
    assert.equal(result.total, 1);
    assert.equal(result.created, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.companies.length, 1);

    const summary = result.companies[0];
    assert.equal(summary.action, "created");
    assert.equal(summary.domain, "riversideautodetailing.com");
    assert.equal(summary.website, "https://riversideautodetailing.com");
    assert.equal(summary.location, "321 River Rd, Austin, TX 78704, USA");

    // Verify DB record matches all provided fields
    const inDb = await prisma.company.findUnique({ where: { id: summary.id } });
    assert.ok(inDb, "Company must exist in DB");
    assert.equal(inDb.userId, PERSIST_TENANT_A, "Must be owned by session tenant only");
    assert.equal(inDb.name, "Riverside Auto Detailing");
    assert.equal(inDb.domain, "riversideautodetailing.com");
    assert.equal(inDb.website, "https://riversideautodetailing.com");
    assert.equal(inDb.industry, "Auto Detailing");
    assert.equal(inDb.location, "321 River Rd, Austin, TX 78704, USA");
    assert.equal(inDb.description, "Premium mobile auto detailing service.");
    assert.equal(inDb.companySize, "1-10");

    // Hard boundary: no leads/opportunities/research
    const leads = await prisma.lead.count({ where: { userId: PERSIST_TENANT_A } });
    const opps = await prisma.opportunity.count({ where: { userId: PERSIST_TENANT_A } });
    assert.equal(leads, 0);
    assert.equal(opps, 0);
  });

  // ---------------------------------------------------------------------------
  // 86. Tenant isolation: persist endpoint is strictly scoped to session tenant
  // ---------------------------------------------------------------------------

  it("86. POST /persist is tenant-isolated — Tenant B cannot see or affect Tenant A companies", async () => {
    // Persist a business as Tenant A
    const reqA = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses/persist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          name: "Isolated Cloud Services",
          domain: "isolated-cloud.io",
          websiteUrl: "https://isolated-cloud.io",
          source: "HUNTER_DISCOVER",
        }),
      }
    );
    const resA = await persistBusinessRoute(reqA);
    assert.equal(resA.status, 200);
    const dataA = await resA.json();
    const companyIdA = dataA.companies[0].id;

    // Persist same domain as Tenant B — must create a SEPARATE company record
    const reqB = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses/persist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieB },
        body: JSON.stringify({
          name: "Isolated Cloud Services",
          domain: "isolated-cloud.io",
          websiteUrl: "https://isolated-cloud.io",
          source: "HUNTER_DISCOVER",
        }),
      }
    );
    const resB = await persistBusinessRoute(reqB);
    assert.equal(resB.status, 200);
    const dataB = await resB.json();
    const companyIdB = dataB.companies[0].id;

    assert.notEqual(companyIdA, companyIdB, "Each tenant gets their own Company record");

    const dbA = await prisma.company.findUnique({ where: { id: companyIdA } });
    const dbB = await prisma.company.findUnique({ where: { id: companyIdB } });
    assert.equal(dbA?.userId, PERSIST_TENANT_A);
    assert.equal(dbB?.userId, PERSIST_TENANT_B);
  });

  // ---------------------------------------------------------------------------
  // 87. Idempotency: persisting the same business twice does not create duplicates
  // ---------------------------------------------------------------------------

  it("87. POST /persist is idempotent — second call updates/matches instead of creating duplicate", async () => {
    const payload = {
      name: "Idempotent Bakery B5A",
      domain: "idempotent-bakery-b5a.com",
      websiteUrl: "https://idempotent-bakery-b5a.com",
      source: "MOCK_SIMULATION",
    };

    const makeReq = () =>
      new NextRequest(
        "http://localhost:3000/api/opportunities/discover/businesses/persist",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieA },
          body: JSON.stringify(payload),
        }
      );

    const res1 = await persistBusinessRoute(makeReq());
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.created, 1);

    const countBefore = await prisma.company.count({ where: { userId: PERSIST_TENANT_A } });

    const res2 = await persistBusinessRoute(makeReq());
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.created, 0, "No new company should be created on second call");
    assert.equal(data2.companies[0].id, data1.companies[0].id, "Same company ID returned");

    const countAfter = await prisma.company.count({ where: { userId: PERSIST_TENANT_A } });
    assert.equal(countAfter, countBefore, "Company count unchanged after idempotent second call");
  });

  // ---------------------------------------------------------------------------
  // 88. Provider selection: providerId is passed through discovery schema
  // ---------------------------------------------------------------------------

  it("88. Discovery endpoint accepts and routes providerId: 'mock' correctly", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          query: "dental",
          providerId: "mock",
          limit: 5,
        }),
      }
    );

    const res = await discoverBusinessesRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.isDevelopmentMock, true, "mock providerId must route to MockBusinessDiscoveryProvider");
    assert.ok(data.businesses.length > 0);
  });

  // ---------------------------------------------------------------------------
  // 89. Google Places business without website — persisted with domain:null
  // ---------------------------------------------------------------------------

  it("89. POST /persist: Google Places business without website URL persists with domain/website null", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/opportunities/discover/businesses/persist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          name: "Corner Barbershop B5A",
          source: "GOOGLE_PLACES",
          externalId: "places_b5a_corner_001",
          headquarters: {
            formattedAddress: "10 Main St, Portland, OR 97201, USA",
            city: "Portland",
            state: "OR",
            country: "US",
          },
          primaryType: "barber_shop",
          rating: 4.6,
          userRatingCount: 31,
        }),
      }
    );

    const res = await persistBusinessRoute(req);
    assert.equal(res.status, 200);
    const result = await res.json();
    assert.equal(result.created, 1);

    const inDb = await prisma.company.findUnique({
      where: { id: result.companies[0].id },
    });
    assert.ok(inDb);
    assert.equal(inDb.domain, null, "Domain must be null when no websiteUrl provided");
    assert.equal(inDb.website, null, "Website must be null when no websiteUrl provided");
    assert.equal(inDb.location, "10 Main St, Portland, OR 97201, USA");
  });

  after(async () => {
    await prisma.opportunity.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.aIResearch.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.lead.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.company.deleteMany({ where: { userId: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [PERSIST_TENANT_A, PERSIST_TENANT_B] } } });
  });
});

