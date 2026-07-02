#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const userAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function main() {
  const [, , input, outputDir] = process.argv;
  if (!input || !outputDir) {
    console.error("Usage: node scripts/download-douyin.js <url-or-share-text> <outputDir>");
    process.exit(2);
  }

  const shareUrl = extractFirstHttpUrl(input);
  if (!shareUrl) {
    throw new Error("No valid Douyin URL found.");
  }

  const resolvedOutputDir = resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  console.error(`[docpilot] resolving Douyin URL: ${shareUrl}`);
  const finalUrl = await resolveShareUrl(shareUrl);
  const videoId = extractVideoId(finalUrl);
  if (!videoId) {
    throw new Error(`Could not extract Douyin video id from ${finalUrl}`);
  }

  console.error(`[docpilot] video id: ${videoId}`);
  const videoPageHtml = await fetchText(`https://www.iesdouyin.com/share/video/${videoId}`);
  const downloadUrl = extractDownloadUrl(videoPageHtml, videoId);
  const targetFile = join(resolvedOutputDir, `${videoId}.mp4`);

  console.error("[docpilot] downloading video file...");
  await downloadFile(downloadUrl, targetFile);

  const fileStat = await stat(targetFile);
  if (fileStat.size <= 0) {
    throw new Error("Downloaded video file is empty.");
  }

  console.error(`[docpilot] downloaded ${formatBytes(fileStat.size)}`);
  console.log(targetFile);
}

function extractFirstHttpUrl(input) {
  const match = input.match(/https?:\/\/[^\s<>"'，。！？、；]+/i);
  return match?.[0]?.replace(/[),.?!，。！？、；;]+$/, "") ?? null;
}

async function resolveShareUrl(url) {
  const response = await fetch(url, {
    headers: buildHeaders(),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Could not resolve share URL: HTTP ${response.status}`);
  }

  return response.url || url;
}

function extractVideoId(url) {
  const decoded = decodeURIComponent(url);
  return (
    decoded.match(/\/video\/([^/?#]+)/)?.[1] ??
    decoded.match(/[?&]modal_id=([^&#]+)/)?.[1] ??
    decoded.match(/[?&]aweme_id=([^&#]+)/)?.[1] ??
    null
  );
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: buildHeaders(),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Could not fetch Douyin video page: HTTP ${response.status}`);
  }

  return response.text();
}

function extractDownloadUrl(html, videoId) {
  const directUrl = findPlayAddrUrl(html);
  if (directUrl) {
    return normalizeVideoUrl(directUrl);
  }

  return `https://aweme.snssdk.com/aweme/v1/play/?video_id=${encodeURIComponent(
    videoId,
  )}`;
}

function findPlayAddrUrl(html) {
  const playAddrIndex = html.indexOf('"play_addr"');
  if (playAddrIndex < 0) {
    return null;
  }

  const nearby = html.slice(playAddrIndex, playAddrIndex + 5000);
  const urlListMatch = nearby.match(/"url_list"\s*:\s*\[([\s\S]*?)\]/);
  if (!urlListMatch) {
    return null;
  }

  const firstUrlMatch = urlListMatch[1]?.match(/"((?:\\.|[^"\\])+)"/);
  if (!firstUrlMatch?.[1]) {
    return null;
  }

  return decodeJsonString(firstUrlMatch[1]);
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replaceAll("\\u0026", "&").replaceAll("\\/", "/");
  }
}

function normalizeVideoUrl(url) {
  return url
    .replaceAll("&amp;", "&")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/")
    .replace("playwm", "play");
}

async function downloadFile(url, targetFile) {
  const response = await fetch(url, {
    headers: buildHeaders(),
    redirect: "follow",
  });

  if (!response.ok || !response.body) {
    throw new Error(`Could not download video: HTTP ${response.status}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(targetFile));
}

function buildHeaders() {
  return {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    Referer: "https://www.douyin.com/",
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
