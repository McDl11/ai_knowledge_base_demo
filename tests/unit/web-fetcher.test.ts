import { describe, expect, it, vi } from "vitest";
import { fetchWebPageText } from "@/lib/knowledge/web-fetcher";

describe("fetchWebPageText", () => {
  it("fetches and extracts text from an HTML page", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        "<html><head><title>工具页面</title></head><body><h1>DocPilot</h1><p>网页正文可以自动入库。</p></body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      ),
    ) as unknown as typeof fetch;

    const page = await fetchWebPageText("https://example.com/tool", fetchImpl);

    expect(page).toMatchObject({
      title: "工具页面",
      text: expect.stringContaining("网页正文可以自动入库"),
    });
  });

  it("ignores non-html responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    await expect(fetchWebPageText("https://example.com/api", fetchImpl)).resolves.toBeNull();
  });
});
