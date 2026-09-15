import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dashboard experience", () => {
  it("contains the analytics and accessibility surfaces", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
    expect(source).toContain("Monthly scans");
    expect(source).toContain("Successful analyses");
    expect(source).toContain("Avg. processing time");
    expect(source).toContain("aria-label=\"Open product tour\"");
    expect(source).toContain("role=\"dialog\"");
    expect(source).toContain("SkeletonRows");
    expect(source).toContain("Quick upload");
  });

  it("enables the shared light and dark theme provider", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(source).toContain('<ThemeProvider defaultTheme="light" switchable>');
  });
});
