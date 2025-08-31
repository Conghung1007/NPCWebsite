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
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollTop(scrollTop > 300);
      console.log('Scroll position:', scrollTop, 'Show button:', scrollTop > 300);
    };

    // Call once to check initial position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    console.log('Scroll to top clicked');
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
      
      {/* Scroll to Top Button - Debug info */}
      <div className="fixed bottom-20 right-4 text-xs bg-black text-white p-2 rounded z-[101]">
        Debug: Scroll={Math.round(window.pageYOffset || 0)}, Show={showScrollTop.toString()}
      </div>
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 rounded-full shadow-lg z-[100] bg-primary hover:bg-primary/90 text-white hover:scale-110 transition-all duration-300"
          size="icon"
          aria-label="Cuộn lên đầu trang"
          data-testid="scroll-to-top-button"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
      
      {/* Always visible test button */}
      <Button
        onClick={scrollToTop}
        className="fixed bottom-16 right-4 w-12 h-12 rounded-full shadow-lg z-[100] bg-red-500 hover:bg-red-600 text-white"
        size="icon"
        title="Test button - always visible"
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
    </div>
  );
}
