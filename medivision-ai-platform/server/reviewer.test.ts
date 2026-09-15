import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "patient" | "doctor" | "admin";

function createContext(role: Role): TrpcContext {
  const now = new Date();
  return {
    user: { id: 1, openId: `review-${role}`, name: "Review User", email: `${role}@example.com`, loginMethod: "clerk", role, createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("reviewer access control", () => {
  it("rejects patients from the reviewer queue", async () => {
    const caller = appRouter.createCaller(createContext("patient"));
    await expect(caller.reviewer.queue()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a doctor to access the reviewer queue", async () => {
    const caller = appRouter.createCaller(createContext("doctor"));
    await expect(caller.reviewer.queue()).resolves.toEqual([]);
  });

  it("does not fabricate a review for a missing report", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.reviewer.get({ reportId: 999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
