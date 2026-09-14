import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPercentage } from "../src/lib/utils";

describe("Analytics Calculations & Funnel Derivations", () => {
  it("safely computes zero percentages without NaN or divide by zero", () => {
    assert.equal(formatPercentage(0, 0), "0.0%");
    assert.equal(formatPercentage(5, 0), "0.0%");
    assert.equal(formatPercentage(NaN, 100), "0.0%");
  });

  it("accurately computes conversion percentages", () => {
    assert.equal(formatPercentage(25, 100), "25.0%");
    assert.equal(formatPercentage(1, 3), "33.3%");
    assert.equal(formatPercentage(7, 20), "35.0%");
  });

  it("calculates realistic sales funnel conversion drops", () => {
    const rawEvents = {
      leads: 120,
      contacted: 80,
      replied: 20,
      positiveReplies: 8,
      meetings: 5,
      clients: 2,
    };

    const replyRate = (rawEvents.replied / rawEvents.contacted) * 100;
    const positiveRate = (rawEvents.positiveReplies / rawEvents.replied) * 100;
    const clientConversionRate = (rawEvents.clients / rawEvents.leads) * 100;

    assert.equal(replyRate, 25);
    assert.equal(positiveRate, 40);
    assert.ok(Math.abs(clientConversionRate - 1.67) < 0.01);
  });
});
