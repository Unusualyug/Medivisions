import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildReportPdf } from "./reports/pdf";
import { scanUploadBuffer } from "./integrations/upload-safety";

describe("professional security and reporting", () => {
  it("rejects the standard malware test signature", () => {
    const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    expect(scanUploadBuffer(eicar).safe).toBe(false);
    expect(scanUploadBuffer(Buffer.from("safe image bytes")).safe).toBe(true);
  });

  it("generates a non-empty PDF report on the server", async () => {
    const pdf = await buildReportPdf({ id: 7, originalFileName: "study.png", studyId: 4, status: "completed", modelVersion: "DenseNet121", findingsJson: JSON.stringify([{ name: "Pneumonia", probability: 0.82, positive: true }]), analysisTimestamp: new Date() });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("configures required Express hardening", () => {
    const source = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(source).toContain("helmet");
    expect(source).toContain("cors");
    expect(source).toContain("rateLimit");
    expect(source).toContain("12mb");
  });
});
