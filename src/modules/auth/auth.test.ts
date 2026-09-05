/**
 * Smoke tests for the auth boundary.
 *
 * Deliberately small and framework-free (`bun test`, no mocks): these run
 * against the real database and assert the two things that are catastrophic
 * when wrong and invisible in manual clicking — that an anonymous request has
 * no session, and that a forged cookie does not produce one.
 *
 * Run: bun test
 */
import { describe, expect, test } from "bun:test";

import { auth } from "./index";

const testWithDatabase = test.skipIf(process.env.SKIP_DATABASE_TESTS === "1");

describe("auth boundary", () => {
  test("a request with no cookies has no session", async () => {
    const session = await auth.api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });

  test("a forged session cookie is rejected", async () => {
    const headers = new Headers({
      cookie: "better-auth.session_token=not-a-real-token.forged-signature",
    });
    const session = await auth.api.getSession({ headers });
    expect(session).toBeNull();
  });

  testWithDatabase("the Google provider is configured", async () => {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: "/" }),
      }),
    );
    // 200 with a redirect URL means the provider exists and credentials are
    // wired; an unknown provider would 400 here.
    expect(response.status).toBe(200);
  });
});
