import { describe, expect, it } from "vitest";

describe("MERN integration credentials", () => {
  it("has a valid MongoDB Atlas URI shape", () => {
    const uri = process.env.MONGODB_URI || "";
    expect(uri).toMatch(/^mongodb\+srv:\/\//);
    expect(uri).toContain("/medivision");
    expect(uri).not.toContain("undefined");
  });

  it("authenticates against Cloudinary's lightweight resources endpoint", async () => {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME || "";
    const apiKey = process.env.CLOUDINARY_API_KEY || "";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
    expect(cloud).toBeTruthy();
    expect(apiKey).toBeTruthy();
    expect(apiSecret).toBeTruthy();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload?max_results=1`, { headers: { Authorization: `Basic ${auth}` }, signal: controller.signal });
      expect(response.status).toBe(200);
    } finally {
      clearTimeout(timer);
    }
  }, 15_000);
});
