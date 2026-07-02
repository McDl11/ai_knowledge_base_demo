import type { Citation } from "@/lib/domain";

const noAnswerMessage =
  "根据当前已上传的资料，我没有找到足够依据回答这个问题。\n你可以补充相关文档后再试。";

export function getNoAnswerMessage(): string {
  return noAnswerMessage;
}

export function shouldUseNoAnswer(
  citations: Pick<Citation, "similarity">[],
  threshold: number,
): boolean {
  if (citations.length === 0) {
    return true;
  }

  return citations.every((citation) => citation.similarity < threshold);
}
