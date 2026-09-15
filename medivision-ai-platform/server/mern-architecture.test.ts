import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getMlServiceUrl } from "./integrations/ml-service";

describe("MERN architecture boundary", () => {
  it("uses the configured Python service URL without exposing credentials", () => {
    expect(getMlServiceUrl()).toMatch(/^https?:\/\//);
    expect(getMlServiceUrl()).not.toContain("MONGODB_URI");
    expect(getMlServiceUrl()).not.toContain("CLOUDINARY_API_SECRET");
  });

  it("contains Cloudinary, MongoDB, and Python service integration in the upload/report API", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(source).toContain("uploadXray");
    expect(source).toContain("mirrorStudy");
    expect(source).toContain("predictWithDenseNet");
    expect(source).toContain("mirrorPrediction");
  });

  it("keeps secret configuration server-side", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/main.tsx"), "utf8");
    expect(source).not.toContain("CLOUDINARY_API_SECRET");
    expect(source).not.toContain("MONGODB_URI");
  });
});
