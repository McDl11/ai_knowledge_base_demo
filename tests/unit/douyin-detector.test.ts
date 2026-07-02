import { describe, expect, it } from "vitest";
import {
  extractFirstHttpUrl,
  isDouyinVideoUrl,
} from "@/lib/video/douyin-detector";

describe("douyin detector", () => {
  it("detects common Douyin share URLs", () => {
    expect(isDouyinVideoUrl("https://v.douyin.com/abc123/")).toBe(true);
    expect(isDouyinVideoUrl("https://www.douyin.com/video/123456")).toBe(true);
    expect(isDouyinVideoUrl("https://iesdouyin.com/share/video/123456")).toBe(
      true,
    );
  });

  it("extracts a Douyin URL from share text", () => {
    const text = "复制打开抖音，看看这个视频 https://v.douyin.com/abc123/，很有用";

    expect(extractFirstHttpUrl(text)).toBe("https://v.douyin.com/abc123/");
    expect(isDouyinVideoUrl(text)).toBe(true);
  });

  it("ignores non-Douyin links", () => {
    expect(isDouyinVideoUrl("https://example.com/video/123")).toBe(false);
    expect(isDouyinVideoUrl("not a url")).toBe(false);
  });
});
