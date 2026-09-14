import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkDuplicate,
  ExistingLeadCandidate,
} from "../src/lib/deduplication/detector";

describe("3-Tier Deduplication Detector", () => {
  const existingCandidates: ExistingLeadCandidate[] = [
    {
      id: "lead_1",
      email: "elena@fintech.io",
      linkedInUrl: "https://linkedin.com/in/elena-rostova",
      fullName: "Elena Rostova",
      companyName: "Fintech Dynamics",
      companyDomain: "fintech.io",
    },
    {
      id: "lead_2",
      email: null,
      linkedInUrl: "https://linkedin.com/in/marcus-brooks",
      fullName: "Marcus Brooks",
      companyName: "CloudScale Systems",
      companyDomain: "cloudscale.net",
    },
    {
      id: "lead_3",
      email: null,
      linkedInUrl: null,
      fullName: "Devon Zhao",
      companyName: "Apex Logistics",
      companyDomain: "apexlogistics.com",
    },
  ];

  it("detects duplicates based on Priority 1: Email (case-insensitive)", () => {
    const result = checkDuplicate(
      { email: "  ELENA@FINTECH.IO  " },
      existingCandidates
    );
    assert.equal(result.isDuplicate, true);
    assert.equal(result.status, "ALREADY_EXISTS");
    assert.equal(result.matchedBy, "email");
    assert.equal(result.matchedLeadId, "lead_1");
  });

  it("detects duplicates based on Priority 2: LinkedIn URL variations", () => {
    const result = checkDuplicate(
      {
        email: "different.email@domain.com",
        linkedInUrl: "http://www.linkedin.com/in/marcus-brooks/?ref=share",
      },
      existingCandidates
    );
    assert.equal(result.isDuplicate, true);
    assert.equal(result.status, "ALREADY_EXISTS");
    assert.equal(result.matchedBy, "linkedin");
    assert.equal(result.matchedLeadId, "lead_2");
  });

  it("detects duplicates based on Priority 3: Name + Company when email/linkedin are absent", () => {
    const result = checkDuplicate(
      {
        fullName: "devon zhao",
        companyName: "Apex Logistics Inc",
      },
      existingCandidates
    );
    assert.equal(result.isDuplicate, true);
    assert.equal(result.matchedBy, "name_company");
    assert.equal(result.matchedLeadId, "lead_3");
  });

  it("approves unique prospects without duplicates", () => {
    const result = checkDuplicate(
      {
        email: "clara.oswald@tardis.org",
        linkedInUrl: "https://linkedin.com/in/clara-oswald",
        fullName: "Clara Oswald",
        companyName: "Coal Hill Academy",
      },
      existingCandidates
    );
    assert.equal(result.isDuplicate, false);
    assert.equal(result.status, "CREATED");
    assert.equal(result.matchedLeadId, undefined);
  });
});
