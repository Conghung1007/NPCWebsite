import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Header } from "./header";
import { Footer } from "./footer";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";
import { PageTransition } from "@/components/motion/PageTransition";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [location] = useLocation();

  // Instant jump to top on navigate — smoother with page-enter than smooth-scroll fight
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
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />

      <Button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 rounded-full shadow-lg z-[100]",
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
