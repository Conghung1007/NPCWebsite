import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  isExamSessionActive,
  isExamSessionPath,
  markExamSessionActive,
  rememberExamReturnPath,
  recoverExamReturnPathIfOverwritten,
} from "@/lib/examReturn";

/**
 * Keeps the last non-exam browse path so “thoát / về sau khi thi”
 * can return where the candidate came from (list, CMS page, …).
 */
export function ExamReturnTracker() {
  const [location] = useLocation();

  useEffect(() => {
    if (isExamSessionActive()) return;
    if (isExamSessionPath(location)) return;
    rememberExamReturnPath(location);
  }, [location]);

  return null;
}

/** Call from exam-taking / exam-result / certificate while those screens are open. */
export function useExamSessionLock() {
  const [location] = useLocation();
  // Sync during render so the tracker effect in the same commit skips this path
  markExamSessionActive(true);
  useEffect(() => {
    markExamSessionActive(true);
    recoverExamReturnPathIfOverwritten(location);
    return () => markExamSessionActive(false);
  }, [location]);
}
