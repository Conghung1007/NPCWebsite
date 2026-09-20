import { portalPath } from "@/lib/portal";

const STORAGE_KEY = "npc:exam-return-path";
const PREV_KEY = "npc:exam-return-prev";

/** Module flag: true while taking / viewing result for an exam attempt. */
let examSessionActive = false;

export function markExamSessionActive(active: boolean) {
  examSessionActive = active;
}

export function isExamSessionActive() {
  return examSessionActive;
}

/** Flat or portal paths that are part of the exam attempt flow. */
export function isExamSessionPath(path: string): boolean {
  const raw = (path || "").split("?")[0]?.split("#")[0] || "";
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  if (
    p.startsWith("/exam/") ||
    p === "/exam" ||
    p.startsWith("/exam-result/") ||
    p.startsWith("/certificate/") ||
    p.startsWith("/exam-attempts/")
  ) {
    return true;
  }
  if (
    /\/exam\/[^/]+/.test(p) ||
    /\/exam-result\/[^/]+/.test(p) ||
    /\/certificate\/[^/]+/.test(p)
  ) {
    return true;
  }
  return false;
}

function isSafeInternalPath(path: string): boolean {
  if (!path || !path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (/^[a-z]+:/i.test(path)) return false;
  return true;
}

function normalizePath(path: string): string {
  return (path || "").split("?")[0]?.split("#")[0] || path;
}

/** Default back target when we never recorded a prior page. */
export function defaultExamReturnPath(): string {
  return portalPath("luyenthi", "/online-exam");
}

/** Remember a browse path to return to after the exam (no-op for exam-session URLs). */
export function rememberExamReturnPath(path: string) {
  if (typeof window === "undefined") return;
  if (!isSafeInternalPath(path)) return;
  if (isExamSessionPath(path)) return;
  try {
    const next = normalizePath(path);
    const cur = sessionStorage.getItem(STORAGE_KEY);
    if (cur && cur !== next) {
      sessionStorage.setItem(PREV_KEY, cur);
    }
    sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
}

/**
 * If the exam slug page briefly overwrote the return path while content loaded,
 * roll back to the previous browse path.
 */
export function recoverExamReturnPathIfOverwritten(currentPath: string) {
  if (typeof window === "undefined") return;
  try {
    const cur = sessionStorage.getItem(STORAGE_KEY);
    const flat = normalizePath(currentPath);
    if (!cur) return;
    if (cur === flat || cur.endsWith(flat) || flat.endsWith(cur)) {
      const prev = sessionStorage.getItem(PREV_KEY);
      if (prev && isSafeInternalPath(prev) && !isExamSessionPath(prev)) {
        sessionStorage.setItem(STORAGE_KEY, prev);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    /* ignore */
  }
}

export function peekExamReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw || !isSafeInternalPath(raw) || isExamSessionPath(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Path to leave the exam flow. Does not clear storage (result page may reuse it). */
export function getExamReturnPath(fallback: string = defaultExamReturnPath()): string {
  return peekExamReturnPath() || fallback;
}

export function clearExamReturnPath() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PREV_KEY);
  } catch {
    /* ignore */
  }
}
