import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("reviewer UI boundary", () => {
  it("keeps AI evidence and human assessment visibly separate", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/ReviewPage.tsx"), "utf8");
    expect(source).toContain("AI output · read-only");
    expect(source).toContain("Human review · editable");
    expect(source).toContain("never overwrite the original AI output");
    expect(source).toContain("Grad-CAM explanation · AI evidence");
    expect(source).toContain("Immutable activity");
    expect(source).toContain("not confirmed diagnoses");
  });

  it("provides reviewer queue and review routes", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(source).toContain('path="/review"');
    expect(source).toContain('path="/review/:id"');
  });
});
