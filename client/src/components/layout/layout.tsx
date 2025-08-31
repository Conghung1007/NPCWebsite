import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Header } from "./header";
import { Footer } from "./footer";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [location] = useLocation();

  // Scroll to top when route changes
  useEffect(() => {
    // Use multiple methods to ensure scroll to top works on all devices
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Then smooth scroll to ensure it's at the very top
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }, [location]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setShowScrollTop(scrollTop > 300);
    };

    // Call once to check initial position
    handleScroll();

    // Use throttling for better performance
    let timeoutId: NodeJS.Timeout;
    const throttledHandleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 16); // ~60fps
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    document.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      document.removeEventListener('scroll', throttledHandleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const scrollToTop = () => {
    // Multiple scroll methods for maximum compatibility
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Smooth scroll for better UX
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
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 rounded-full shadow-lg z-[100] bg-primary hover:bg-primary/90 text-white hover:scale-110 transition-all duration-300"
          size="icon"
          aria-label="Cuộn lên đầu trang"
          data-testid="scroll-to-top-button"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
