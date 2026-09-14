import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  requireAuthUser,
  assertResourceOwnership,
  ForbiddenError,
} from "../src/lib/auth/session";

describe("Authorization and User Isolation", () => {
  it("extracts authenticated user from authorization bearer test header", async () => {
    const fakeRequest = new Request("http://localhost:3000/api/leads", {
      headers: { authorization: "Bearer test-user-99" },
    });

    const user = await requireAuthUser(fakeRequest);
    assert.equal(user.id, "test-user-99");
    assert.equal(user.email, "test-user-99@example.com");
  });

  it("extracts authenticated user from custom authenticated user header", async () => {
    const fakeRequest = new Request("http://localhost:3000/api/leads", {
      headers: { "x-authenticated-user-id": "usr_tenant_42" },
    });

    const user = await requireAuthUser(fakeRequest);
    assert.equal(user.id, "usr_tenant_42");
  });

  it("enforces resource ownership and throws ForbiddenError on cross-tenant access", () => {
    const currentUserId = "usr_alice";
    const resourceUserId = "usr_bob";

    assert.throws(
      () => {
        assertResourceOwnership(resourceUserId, currentUserId);
      },
      ForbiddenError
    );
  });

  it("passes ownership check when user IDs match", () => {
    assert.doesNotThrow(() => {
      assertResourceOwnership("usr_alice", "usr_alice");
    });
  });
});
