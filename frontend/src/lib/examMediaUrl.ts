/**
 * Normalize exam/qbank media URLs for playback.
 * Permanent URLs already start with /api/...; bare filenames get a sensible fallback.
 */
export function resolveExamMediaUrl(
  url: string | null | undefined,
  kind: "section-description-audio" | "question-description-audio" | "question-audio" = "question-audio"
): string {
  if (!url) return "";
  if (url.startsWith("/api/") || /^https?:\/\//i.test(url)) {
    return url;
  }
  // Strip accidental leading folder segments
  const filename = url.includes("/") ? url.split("/").pop()! : url;
  switch (kind) {
    case "section-description-audio":
      return `/api/exam-description-audio/${filename}`;
    case "question-description-audio":
      return `/api/qbank-description-audio/${filename}`;
    case "question-audio":
    default:
      return `/api/qbank-audio/${filename}`;
  }
}
