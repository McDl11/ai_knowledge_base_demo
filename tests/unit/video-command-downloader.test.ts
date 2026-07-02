import { describe, expect, it } from "vitest";
import { buildDownloaderArgs } from "@/lib/video/video-command-downloader";

describe("buildDownloaderArgs", () => {
  it("uses url and output dir as default arguments", () => {
    expect(
      buildDownloaderArgs(undefined, {
        url: "https://v.douyin.com/abc/",
        outputDir: "D:\\tmp\\video",
      }),
    ).toEqual(["https://v.douyin.com/abc/", "D:\\tmp\\video"]);
  });

  it("replaces placeholders from a JSON argument template", () => {
    expect(
      buildDownloaderArgs("[\"download.js\",\"{url}\",\"--out\",\"{outputDir}\"]", {
        url: "https://v.douyin.com/abc/",
        outputDir: "D:\\tmp\\video",
      }),
    ).toEqual([
      "download.js",
      "https://v.douyin.com/abc/",
      "--out",
      "D:\\tmp\\video",
    ]);
  });

  it("supports a simple quoted argument template", () => {
    expect(
      buildDownloaderArgs("'download script.js' {url} --dir \"{outputDir}\"", {
        url: "https://v.douyin.com/abc/",
        outputDir: "D:\\tmp\\video",
      }),
    ).toEqual([
      "download script.js",
      "https://v.douyin.com/abc/",
      "--dir",
      "D:\\tmp\\video",
    ]);
  });
});
