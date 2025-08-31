import { ReactNode, useEffect, useState } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.pageYOffset > 300);
    };

    // Throttle scroll events for better performance
    let timeoutId: NodeJS.Timeout;
    const throttledHandleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 10);
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg z-50 btn-primary hover:scale-110 transition-all duration-300 scroll-to-top-enter"
          size="icon"
          aria-label="Cuộn lên đầu trang"
          data-testid="scroll-to-top-button"
        >
          <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      )}
    </div>
  );
}
