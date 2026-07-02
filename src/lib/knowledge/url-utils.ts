const trailingUrlPunctuation = /[),.?!，。！？、；;]+$/;

export function extractFirstHttpUrl(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s<>"'，。！？、；]+/i);
  if (!match) {
    return null;
  }

  return match[0].replace(trailingUrlPunctuation, "");
}
