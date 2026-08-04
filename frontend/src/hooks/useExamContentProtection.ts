import { useEffect } from "react";

/**
 * Client-side content protection for exam taking / result pages.
 * Deterrent only — does not stop screenshots or DevTools.
 */
export function useExamContentProtection(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const prevent = (e: Event) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // Copy / cut / select-all / save / view-source / print
      if (["c", "x", "a", "s", "u", "p"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("img, picture, video, canvas, .exam-protected-media")) {
        e.preventDefault();
      }
    };

    document.addEventListener("copy", prevent, true);
    document.addEventListener("cut", prevent, true);
    document.addEventListener("contextmenu", prevent, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("dragstart", onDragStart, true);

    return () => {
      document.removeEventListener("copy", prevent, true);
      document.removeEventListener("cut", prevent, true);
      document.removeEventListener("contextmenu", prevent, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("dragstart", onDragStart, true);
    };
  }, [enabled]);
}
