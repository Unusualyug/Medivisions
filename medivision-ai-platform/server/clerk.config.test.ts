import { describe, expect, it } from "vitest";

describe("Clerk configuration", () => {
  it("exposes a reachable JWKS endpoint and expected issuer configuration", async () => {
    const jwksUrl = process.env.CLERK_JWKS_URL;
    const issuerUrl = process.env.CLERK_ISSUER_URL;

    expect(jwksUrl).toMatch(/^https:\/\/.+\/\.well-known\/jwks\.json$/);
    expect(issuerUrl).toMatch(/^https:\/\/.+$/);

    const response = await fetch(jwksUrl!);
    expect(response.ok).toBe(true);
    const payload = await response.json();
    expect(Array.isArray(payload.keys)).toBe(true);
    expect(payload.keys.length).toBeGreaterThan(0);
  }, 15000);
});
