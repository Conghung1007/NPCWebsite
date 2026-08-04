import { multiR2Storage } from "./multiR2Storage";

/** Temp media prefixes used by exam / question bank uploads */
export const TEMP_MEDIA_PREFIXES = [
  "qbank-temp-images/",
  "qbank-temp-answer-images/",
  "qbank-temp-audio/",
  "qbank-temp-description-images/",
  "qbank-temp-description-audio/",
  "exam-temp-images/",
  "exam-temp-answer-images/",
  "exam-temp-audio/",
  "exam-temp-description-images/",
  "exam-temp-description-audio/",
  // Legacy folders (pre-context)
  "temp-images/",
  "temp-question-images/",
  "temp-answer-images/",
  "temp-audio/",
  "temp-description-images/",
  "temp-description-audio/",
  "article-temp-images/",
] as const;

export interface TempGcResult {
  scanned: number;
  deleted: number;
  failed: number;
  maxAgeHours: number;
  prefixes: string[];
  errors: string[];
}

/**
 * Delete abandoned temp R2 objects older than maxAgeHours.
 * Safe for production: only touches *-temp-* / legacy temp-* prefixes.
 */
export async function cleanupAbandonedTempMedia(
  maxAgeHours = Number(process.env.TEMP_MEDIA_GC_HOURS || 24),
  provider = "primary",
): Promise<TempGcResult> {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const result: TempGcResult = {
    scanned: 0,
    deleted: 0,
    failed: 0,
    maxAgeHours,
    prefixes: [...TEMP_MEDIA_PREFIXES],
    errors: [],
  };

  for (const prefix of TEMP_MEDIA_PREFIXES) {
    const objects = await multiR2Storage.listAllObjects(provider, prefix);
    for (const obj of objects) {
      result.scanned += 1;
      if (obj.lastModified.getTime() > cutoff) continue;

      const del = await multiR2Storage.deleteFile(provider, obj.key);
      if (del.success) {
        result.deleted += 1;
        console.log(`[temp-gc] deleted ${obj.key} (age > ${maxAgeHours}h)`);
      } else {
        result.failed += 1;
        if (del.error) result.errors.push(`${obj.key}: ${del.error}`);
      }
    }
  }

  console.log(
    `[temp-gc] done — scanned=${result.scanned} deleted=${result.deleted} failed=${result.failed}`,
  );
  return result;
}

let gcTimer: ReturnType<typeof setInterval> | null = null;

/** Start periodic GC (default every 6 hours). No-op if already running. */
export function startTempMediaGcScheduler(
  intervalMs = Number(process.env.TEMP_MEDIA_GC_INTERVAL_MS || 6 * 60 * 60 * 1000),
): void {
  if (gcTimer) return;

  const run = () => {
    cleanupAbandonedTempMedia().catch((err) => {
      console.error("[temp-gc] scheduled run failed:", err);
    });
  };

  // First run after a short delay so boot isn't blocked
  setTimeout(run, 60_000);
  gcTimer = setInterval(run, intervalMs);
  // Avoid keeping process alive solely for GC in some environments
  if (typeof gcTimer === "object" && "unref" in gcTimer) {
    (gcTimer as NodeJS.Timeout).unref?.();
  }

  console.log(
    `[temp-gc] scheduler started (interval=${Math.round(intervalMs / 3600000)}h, maxAge=${process.env.TEMP_MEDIA_GC_HOURS || 24}h)`,
  );
}
