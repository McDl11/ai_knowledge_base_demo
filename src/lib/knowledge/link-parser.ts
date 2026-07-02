import { ingestKnowledgeSource } from "@/lib/knowledge/ingestion";
import { fetchWebPageText } from "@/lib/knowledge/web-fetcher";
import { isDouyinVideoUrl } from "@/lib/video/douyin-detector";
import { extractVideoKnowledgeFromUrl } from "@/lib/video/video-processing";
import { ingestVideoLink } from "@/lib/knowledge/video-link-ingestion";

interface IngestLinkOptions {
  videoProcessor?: typeof extractVideoKnowledgeFromUrl;
}

export async function ingestLink(input: {
  url: string;
  title?: string;
  content?: string;
}, options: IngestLinkOptions = {}) {
  const videoMetadata = await tryIngestVideoLink(input, options);
  if (videoMetadata?.item) {
    return videoMetadata.item;
  }

  const fetched = input.content ? null : await fetchWebPageText(input.url).catch(() => null);

  return ingestKnowledgeSource({
    kind: "link",
    url: input.url,
    title: input.title,
    content: input.content,
    fetchedUrl: fetched?.url,
    fetchedTitle: fetched?.title,
    fetchedText: fetched?.text,
  });
}

async function tryIngestVideoLink(
  input: {
    url: string;
    title?: string;
    content?: string;
  },
  options: IngestLinkOptions,
): Promise<{ item?: Awaited<ReturnType<typeof ingestKnowledgeSource>> } | null> {
  if (!isDouyinVideoUrl(input.url)) {
    return null;
  }

  return {
    item: await ingestVideoLink(input, {
      videoProcessor: options.videoProcessor,
    }),
  };
}
