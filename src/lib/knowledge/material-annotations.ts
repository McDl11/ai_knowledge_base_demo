import type { JsonRecord } from "@/lib/domain";

export interface MaterialAnnotation {
  id: string;
  quote: string;
  note: string;
  createdAt: string;
}

export function getMaterialAnnotations(
  metadata: JsonRecord,
): MaterialAnnotation[] {
  const annotations = metadata.annotations;
  if (!Array.isArray(annotations)) {
    return [];
  }

  return annotations.filter(isMaterialAnnotation);
}

function isMaterialAnnotation(value: unknown): value is MaterialAnnotation {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "quote" in value &&
    "note" in value &&
    "createdAt" in value &&
    typeof value.id === "string" &&
    typeof value.quote === "string" &&
    typeof value.note === "string" &&
    typeof value.createdAt === "string"
  );
}
