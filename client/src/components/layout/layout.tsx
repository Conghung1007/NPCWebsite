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
    // Most aggressive scroll to top approach
    const forceScrollToTop = () => {
      // Method 1: Standard window scroll
      window.scrollTo(0, 0);
      
      // Method 2: Document element scroll
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      
      // Method 3: Body scroll
      if (document.body) {
        document.body.scrollTop = 0;
      }
      
      // Method 4: Manual element manipulation
      const allScrollableElements = document.querySelectorAll('*');
      allScrollableElements.forEach(element => {
        if (element.scrollTop && element.scrollTop > 0) {
          element.scrollTop = 0;
        }
      });
      
      // Method 5: History manipulation for SPA
      if (window.history && window.history.scrollRestoration) {
        window.history.scrollRestoration = 'manual';
      }
      
      // Method 6: Scroll to header specifically
      const header = document.getElementById('page-header');
      if (header) {
        header.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      
      // Method 7: Additional scroll reset methods
      try {
        // Reset scroll for iOS Safari
        document.querySelector('html')?.scrollTo(0, 0);
        document.querySelector('body')?.scrollTo(0, 0);
      } catch (e) {
        // Ignore errors
      }
    };

    // Execute multiple times with different timing
    forceScrollToTop();
    requestAnimationFrame(forceScrollToTop);
    setTimeout(forceScrollToTop, 1);
    setTimeout(forceScrollToTop, 10);
    setTimeout(forceScrollToTop, 50);
    setTimeout(forceScrollToTop, 100);
    setTimeout(forceScrollToTop, 200);
    
    // Update scroll tracking
    setTimeout(() => {
      const handleScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        setShowScrollTop(scrollTop > 300);
      };
      handleScroll();
    }, 250);
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
    // Force immediate scroll first
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Then smooth scroll for better UX
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, 10);
    
    // Ensure we're at the top
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 500);
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
