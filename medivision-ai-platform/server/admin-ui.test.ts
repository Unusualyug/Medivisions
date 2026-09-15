import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("admin console safeguards", () => {
  it("does not show performance values before a real evaluation run", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPage.tsx"), "utf8");
    expect(source).toContain("Not evaluated yet");
    expect(source).toContain("ROC-AUC, precision, recall, F1, sensitivity, specificity");
    expect(source).toContain("Real evaluation result");
    expect(source).toContain("Evaluation integrity");
  });

  it("contains the requested governance surfaces", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPage.tsx"), "utf8");
    expect(source).toContain("Users and roles");
    expect(source).toContain("Model versions");
    expect(source).toContain("Upload a new checkpoint");
    expect(source).toContain("System activity");
    expect(source).toContain("Announcements");
    expect(source).toContain("Server health");
    expect(source).toContain("Import real evaluation results");
    expect(source).toContain("Model comparison dashboard");
  });
});
