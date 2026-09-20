/**
 * Normalize exam/qbank media URLs for playback / display.
 * Permanent URLs already start with /api/...; bare filenames get a sensible fallback.
 */

/** Coerce DB jsonb / legacy string JSON into a clean URL list. */
export function asMediaUrlList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        return asMediaUrlList(JSON.parse(t));
      } catch {
        return [t];
      }
    }
    return [t];
  }
  return [];
}

export function resolveExamMediaUrl(
  url: string | null | undefined,
  kind: "section-description-audio" | "question-description-audio" | "question-audio" = "question-audio"
): string {
  if (!url) return "";
  const raw = url.trim();
  if (!raw) return "";
  if (raw.startsWith("/api/") || /^https?:\/\//i.test(raw) || raw.startsWith("blob:")) {
    return raw;
  }
  // Strip accidental leading folder segments
  const filename = raw.includes("/") ? raw.split("/").pop()! : raw;
  if (!filename) return "";

  // Infer folder from path hints when present (legacy / migrated URLs)
  if (raw.includes("exam-description-audio") || raw.includes("exam-temp-description-audio")) {
    return `/api/exam-description-audio/${filename}`;
  }
  if (raw.includes("qbank-description-audio") || raw.includes("description-audio")) {
    return `/api/qbank-description-audio/${filename}`;
  }
  if (raw.includes("exam-audio") || raw.includes("exam-temp-audio")) {
    return `/api/exam-audio/${filename}`;
  }
  if (raw.includes("qbank-audio") || raw.includes("temp-audio")) {
    return `/api/qbank-audio/${filename}`;
  }

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

/**
 * Resolve question / answer / description image URLs (legacy bare filenames included).
 */
export function resolveExamImageUrl(
  url: string | null | undefined,
  kind: "question" | "answer" | "description" = "question",
): string {
  if (!url) return "";
  const raw = url.trim();
  if (!raw) return "";
  if (
    raw.startsWith("/api/") ||
    /^https?:\/\//i.test(raw) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }
  const filename = raw.includes("/") ? raw.split("/").pop()! : raw;
  if (raw.includes("answer")) {
    if (raw.includes("exam")) return `/api/exam-answer-images/${filename}`;
    return `/api/qbank-answer-images/${filename}`;
  }
  if (kind === "answer") {
    return `/api/qbank-answer-images/${filename}`;
  }
  if (kind === "description" || raw.includes("description")) {
    if (raw.includes("exam")) return `/api/exam-description-images/${filename}`;
    return `/api/qbank-description-images/${filename}`;
  }
  if (raw.includes("exam")) return `/api/exam-images/${filename}`;
  if (raw.includes("question-images")) return `/api/question-images/${filename}`;
  return `/api/qbank-images/${filename}`;
}
