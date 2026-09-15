import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const now = new Date();
  const user: AuthenticatedUser = {
    id: 1,
    openId: "xray-test-user",
    name: "X-ray Test User",
    email: "xray@example.com",
    loginMethod: "clerk",
    role: "patient",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
  return {
    user,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("xray.upload validation", () => {
  it("rejects unsupported file formats before storage", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.xray.upload({
      fileName: "scan.gif",
      mimeType: "image/gif" as "image/jpeg",
      sizeBytes: 4,
      width: 512,
      height: 512,
      qualityStatus: "pass",
      dataUrl: "data:image/gif;base64,AAAA",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a payload whose bytes do not match its declared format", async () => {
    const caller = appRouter.createCaller(createContext());
    const dataUrl = `data:image/jpeg;base64,${Buffer.from("not-a-jpeg").toString("base64")}`;
    await expect(caller.xray.upload({
      fileName: "scan.jpg",
      mimeType: "image/jpeg",
      sizeBytes: Buffer.from("not-a-jpeg").length,
      width: 512,
      height: 512,
      qualityStatus: "pass",
      dataUrl,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not expose an unknown secure report link", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.reports.public({ token: "unknown-report-token-123456" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
