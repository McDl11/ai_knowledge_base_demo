import { extractFirstHttpUrl } from "@/lib/knowledge/url-utils";

export { extractFirstHttpUrl } from "@/lib/knowledge/url-utils";

export function isDouyinVideoUrl(input: string): boolean {
  const candidate = extractFirstHttpUrl(input) ?? input;

  try {
    const url = new URL(candidate.trim());
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === "douyin.com" ||
      hostname.endsWith(".douyin.com") ||
      hostname === "iesdouyin.com" ||
      hostname.endsWith(".iesdouyin.com") ||
      hostname === "amemv.com" ||
      hostname.endsWith(".amemv.com")
    );
  } catch {
    return false;
  }
}
