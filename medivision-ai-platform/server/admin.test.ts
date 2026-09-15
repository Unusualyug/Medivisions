import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "patient" | "doctor" | "admin";

function context(role: Role): TrpcContext {
  const now = new Date();
  return { user: { id: 1, openId: `admin-test-${role}`, name: "Admin Test", email: "admin@example.com", loginMethod: "clerk", role, isActive: 1, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("admin governance access", () => {
  it("rejects non-admin users from the admin overview", async () => {
    await expect(appRouter.createCaller(context("doctor")).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows administrators to read a safe empty overview", async () => {
    const overview = await appRouter.createCaller(context("admin")).admin.overview();
    expect(overview.evaluations).toEqual([]);
    expect(overview.health.status).toBe("operational");
  });

  it("prevents an administrator from disabling their own account", async () => {
    await expect(appRouter.createCaller(context("admin")).admin.updateUser({ openId: "admin-test-admin", isActive: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
