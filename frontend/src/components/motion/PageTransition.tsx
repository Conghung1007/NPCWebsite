import { ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Soft page enter on route change (opacity + slight rise).
 * Keyed by location so each navigation remounts the animation.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    // Scroll-reveal for sections after paint (skip first/hero — already in page-enter)
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("section"),
    );
    if (sections.length === 0) return;

    sections.forEach((el, i) => {
      if (i === 0) {
        el.classList.add("is-inview");
        return;
      }
      el.classList.add("reveal-section");
      el.classList.remove("is-inview");
    });

    if (typeof IntersectionObserver === "undefined") {
      sections.forEach((el) => el.classList.add("is-inview"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-inview");
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        // Earlier trigger on mobile so content doesn't pop in late
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08,
      },
    );

    sections.slice(1).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [location]);

  return (
    <div
      key={location}
      ref={mainRef}
      className="page-enter w-full"
    >
      {children}
    </div>
  );
}
