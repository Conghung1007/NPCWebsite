import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Header } from "./header";
import { Footer } from "./footer";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";
import { PageTransition } from "@/components/motion/PageTransition";
import { PageViewTracker } from "@/components/PageViewTracker";
import { SitePopup } from "@/components/SitePopup";
import {
  FloatingContactWidgets,
  useFloatStackCount,
} from "@/components/FloatingContactWidgets";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [location] = useLocation();
  const floatCount = useFloatStackCount();
  const scrollTopBottom =
    floatCount <= 0
      ? "bottom-4 sm:bottom-6"
      : floatCount === 1
        ? "bottom-28 sm:bottom-32"
        : floatCount === 2
          ? "bottom-40 sm:bottom-44"
          : "bottom-[17.5rem] sm:bottom-[19rem]";

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setShowScrollTop(scrollTop > 280);
    };

    handleScroll();

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col w-full max-w-full">
      <PageViewTracker />
      <SitePopup />
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <FloatingContactWidgets />

      <Button
        onClick={scrollToTop}
        className={cn(
          "fixed right-4 sm:right-6 w-12 h-12 rounded-full shadow-lg z-[100]",
          scrollTopBottom,
          "bg-primary hover:bg-[hsl(142,76%,30%)] text-white",
          "transition-all duration-300 ease-out",
          showScrollTop
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-3 pointer-events-none",
        )}
        size="icon"
        aria-label="Cuộn lên đầu trang"
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
        data-testid="scroll-to-top-button"
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
    </div>
  );
}
