import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizeDomain,
  createNameCompanyKey,
} from "../src/lib/deduplication/normalizer";

describe("Email Normalization", () => {
  it("trims whitespace and converts to lowercase", () => {
    assert.equal(normalizeEmail("  Alex.Vance@Company.COM  "), "alex.vance@company.com");
  });

  it("normalizes gmail addresses by stripping dots and sub-addresses", () => {
    assert.equal(normalizeEmail("john.doe+work@gmail.com"), "johndoe@gmail.com");
    assert.equal(normalizeEmail("j.o.h.n.d.o.e@googlemail.com"), "johndoe@gmail.com");
  });

  it("handles trailing periods in domain", () => {
    assert.equal(normalizeEmail("user@domain.com."), "user@domain.com");
  });

  it("returns null for invalid email formats", () => {
    assert.equal(normalizeEmail("notanemail"), null);
    assert.equal(normalizeEmail(""), null);
    assert.equal(normalizeEmail(null), null);
    assert.equal(normalizeEmail(undefined), null);
  });
});

describe("LinkedIn URL Normalization", () => {
  it("normalizes protocol, subdomains, and trailing slashes", () => {
    assert.equal(
      normalizeLinkedInUrl("http://www.linkedin.com/in/sarahconnor/"),
      "https://linkedin.com/in/sarahconnor"
    );
    assert.equal(
      normalizeLinkedInUrl("https://uk.linkedin.com/in/sarahconnor"),
      "https://linkedin.com/in/sarahconnor"
    );
  });

  it("strips URL tracking query parameters and hash fragments", () => {
    assert.equal(
      normalizeLinkedInUrl(
        "https://www.linkedin.com/in/sarahconnor?utm_source=share&miniProfileUrn=urn%3Ali"
      ),
      "https://linkedin.com/in/sarahconnor"
    );
  });

  it("normalizes naked paths", () => {
    assert.equal(
      normalizeLinkedInUrl("linkedin.com/in/sarahconnor"),
      "https://linkedin.com/in/sarahconnor"
    );
  });

  it("returns null for non-linkedin urls", () => {
    assert.equal(normalizeLinkedInUrl("https://twitter.com/sarahconnor"), null);
    assert.equal(normalizeLinkedInUrl(""), null);
    assert.equal(normalizeLinkedInUrl(null), null);
  });
});

describe("Domain & Composite Key Normalization", () => {
  it("extracts clean root hostnames", () => {
    assert.equal(normalizeDomain("https://www.acme.co/pricing?ref=google"), "acme.co");
    assert.equal(normalizeDomain("acmecorp.com/careers"), "acmecorp.com");
  });

  it("creates deterministic composite keys for Name + Company", () => {
    const key1 = createNameCompanyKey("Sarah Connor", "Acme Corp");
    const key2 = createNameCompanyKey("  sarah   connor  ", "https://acme.corp");
    assert.equal(key1, "sarah connor:::acme");
    assert.equal(key2, "sarah connor:::acme.corp");
  });

  it("returns null if either name or company is missing", () => {
    assert.equal(createNameCompanyKey("", "Acme"), null);
    assert.equal(createNameCompanyKey("Sarah", ""), null);
  });
});
