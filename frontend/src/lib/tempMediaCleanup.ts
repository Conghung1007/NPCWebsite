/** Shared helpers to delete abandoned temp R2 media from the browser. */

export type TempMediaContext = "qbank" | "exam";

type CleanupBucket =
  | "questionImages"
  | "answerImages"
  | "audio"
  | "descriptionImages"
  | "descriptionAudio"
  | "articleImages";

const TEMP_PATTERNS: Array<{
  bucket: CleanupBucket;
  test: (url: string) => boolean;
}> = [
  {
    bucket: "descriptionAudio",
    test: (u) =>
      /\/api\/(qbank|exam)-temp-description-audio\//.test(u) ||
      u.includes("/api/temp-description-audio/"),
  },
  {
    bucket: "descriptionImages",
    test: (u) =>
      /\/api\/(qbank|exam)-temp-description-images\//.test(u) ||
      u.includes("/api/temp-description-images/"),
  },
  {
    bucket: "answerImages",
    test: (u) =>
      /\/api\/(qbank|exam)-temp-answer-images\//.test(u) ||
      u.includes("/api/temp-answer-images/"),
  },
  {
    bucket: "audio",
    test: (u) =>
      (/\/api\/(qbank|exam)-temp-audio\//.test(u) ||
        u.includes("/api/temp-audio/")) &&
      !u.includes("description-audio"),
  },
  {
    bucket: "questionImages",
    test: (u) =>
      /\/api\/(qbank|exam)-temp-images\//.test(u) ||
      u.includes("/api/temp-question-images/"),
  },
  {
    bucket: "articleImages",
    test: (u) => u.includes("/api/article-temp-images/"),
  },
];

const CLEANUP_ENDPOINTS: Record<
  CleanupBucket,
  (ctx: TempMediaContext) => string
> = {
  questionImages: (ctx) => `/api/temp-question-images/cleanup?context=${ctx}`,
  answerImages: (ctx) => `/api/temp-answer-images/cleanup?context=${ctx}`,
  audio: (ctx) => `/api/temp-audio/cleanup?context=${ctx}`,
  descriptionImages: (ctx) =>
    `/api/temp-description-images/cleanup?context=${ctx}`,
  descriptionAudio: (ctx) =>
    `/api/temp-description-audio/cleanup?context=${ctx}`,
  articleImages: () => `/api/article-temp-images/cleanup`,
};

export function isTempMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return TEMP_PATTERNS.some((p) => p.test(url));
}

export function tempMediaFilename(url: string): string | null {
  const name = url.split("/").pop()?.split("?")[0];
  return name || null;
}

function classify(url: string): CleanupBucket | null {
  for (const p of TEMP_PATTERNS) {
    if (p.test(url)) return p.bucket;
  }
  return null;
}

/** Fire-and-forget cleanup for one or many temp URLs. */
export async function cleanupTempMediaUrls(
  urls: Array<string | null | undefined>,
  context: TempMediaContext = "qbank",
): Promise<void> {
  const buckets: Record<CleanupBucket, string[]> = {
    questionImages: [],
    answerImages: [],
    audio: [],
    descriptionImages: [],
    descriptionAudio: [],
    articleImages: [],
  };

  for (const url of urls) {
    if (!url) continue;
    const bucket = classify(url);
    const filename = tempMediaFilename(url);
    if (!bucket || !filename) continue;
    if (!buckets[bucket].includes(filename)) {
      buckets[bucket].push(filename);
    }
  }

  const requests: Promise<unknown>[] = [];
  (Object.keys(buckets) as CleanupBucket[]).forEach((bucket) => {
    const filenames = buckets[bucket];
    if (filenames.length === 0) return;
    requests.push(
      fetch(CLEANUP_ENDPOINTS[bucket](context), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames }),
        credentials: "include",
      }).catch((e) =>
        console.warn(`Failed to cleanup ${bucket}:`, e),
      ),
    );
  });

  if (requests.length > 0) {
    await Promise.all(requests);
  }
}

export function cleanupTempMediaUrl(
  url: string | null | undefined,
  context: TempMediaContext = "qbank",
): void {
  if (!url || !isTempMediaUrl(url)) return;
  void cleanupTempMediaUrls([url], context);
}

/** Collect temp URLs from TipTap/HTML content (`<img src>`). */
export function extractImageUrlsFromHtml(html: string): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

export function extractTempImageUrlsFromHtml(html: string): string[] {
  return extractImageUrlsFromHtml(html).filter(isTempMediaUrl);
}
