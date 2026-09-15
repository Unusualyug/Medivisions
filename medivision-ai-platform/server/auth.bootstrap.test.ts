import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("auth bootstrap", () => {
  it("uses a stable Clerk-aware tRPC client with React Query outside the provider", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/main.tsx"), "utf8");
    expect(source).toContain("ClerkProvider");
    expect(source).toContain("useMemo(() => trpc.createClient");
    expect(source).toContain("<QueryClientProvider client={queryClient}>");
    expect(source).toContain("<trpc.Provider client={trpcClient} queryClient={queryClient}>");
    expect(source).toContain("<ClerkTrpcProvider>");
  });
});
