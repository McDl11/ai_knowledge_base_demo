export function formatCitationSummary(
  content: string,
  maxChars: number = 240,
): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}
