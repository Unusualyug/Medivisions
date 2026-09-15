import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("administrator role synchronization", () => {
  it("does not send a default patient role during Clerk sync", () => {
    const source = readFileSync(resolve(process.cwd(), "server/_core/context.ts"), "utf8");
    expect(source).toContain("...(role === \"doctor\" || role === \"admin\" ? { role } : {})");
    expect(source).not.toContain('role: role === "doctor" || role === "admin" ? role : "patient",\n    lastSignedIn');
  });

  it("reads the effective role from the application backend on the admin page", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPage.tsx"), "utf8");
    expect(source).toContain("trpc.auth.me.useQuery");
    expect(source).toContain("appUser.data?.role");
  });
});
