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
} from "../src/lib/providers/business-discovery";
import { businessDiscoverySearchSchema } from "../src/lib/validation/business-discovery";
import { discoverBusinesses } from "../src/lib/services/business-discovery-service";
import { POST as discoverBusinessesRoute } from "../src/app/api/opportunities/discover/businesses/route";

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
});
