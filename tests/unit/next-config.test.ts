import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("nextConfig", () => {
  it("allows localhost development without pinning a private LAN address", () => {
    expect(nextConfig.allowedDevOrigins ?? []).toEqual(["127.0.0.1"]);
  });

  it("keeps pdf-parse external to the server bundle so its worker file resolves", () => {
    expect(nextConfig.serverExternalPackages ?? []).toContain("pdf-parse");
  });

  it("hides the English Next.js development indicator from the app surface", () => {
    expect(nextConfig.devIndicators).toBe(false);
  });
});
