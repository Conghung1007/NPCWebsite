import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import type { Article } from "@shared/schema";

interface ServiceWithArticlesProps {
  service: {
    icon: React.ReactNode;
    title: string;
    description: string;
    route: string;
  };
  category: string;
  onServiceClick: () => void;
}

// Simple Badge component
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function ServiceWithArticles({ 
  service, 
  category, 
  onServiceClick 
}: ServiceWithArticlesProps) {
  const { data: allArticles = [], isLoading } = useQuery<Article[]>({
    queryKey: ['/api/articles'],
  });

  // State for carousel
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter articles by category
  const categoryArticles = allArticles.filter(article => article.category === category);
  
  // Number of articles to show at once (responsive)
  const getArticlesPerView = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1024) return 3; // lg: 3 columns
      if (window.innerWidth >= 768) return 2;  // md: 2 columns  
      return 1; // sm: 1 column
    }
    return 3; // default
  };
  
  const [articlesPerView, setArticlesPerView] = useState(getArticlesPerView);
  const maxIndex = Math.max(0, categoryArticles.length - articlesPerView);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setArticlesPerView(getArticlesPerView());
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Navigation functions
  const goToPrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => Math.min(maxIndex, prev + 1));
  };

  // Auto-scroll functionality
  useEffect(() => {
    if (categoryArticles.length <= articlesPerView || isHovered) return; // Don't auto-scroll if all articles fit or user is hovering

    const autoScrollInterval = setInterval(() => {
      setCurrentIndex(prev => {
        // If at the end, go back to beginning
        if (prev >= maxIndex) {
          return 0;
        }
        // Otherwise, go to next
        return prev + 1;
      });
    }, 30000); // 30 seconds

    return () => clearInterval(autoScrollInterval);
  }, [categoryArticles.length, articlesPerView, maxIndex, isHovered]);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'visa-services': 'Visa',
      'study-abroad': 'Du học', 
      'japanese-training': 'Tiếng Nhật',
      'flight-tickets': 'Vé máy bay'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'visa-services': 'bg-blue-100 text-blue-800',
      'study-abroad': 'bg-purple-100 text-purple-800',
      'japanese-training': 'bg-orange-100 text-orange-800',
      'flight-tickets': 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Service Info */}
      <div className="flex-1 lg:max-w-md">
        <div className="bg-white rounded-xl p-8 shadow-lg h-[400px] flex flex-col justify-between">
          <div>
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
              {service.icon}
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-4">{service.title}</h3>
            <p className="text-lg text-muted-foreground mb-6">{service.description}</p>
          </div>
          <Button onClick={onServiceClick} className="w-full mt-auto">
            Tìm hiểu thêm
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Related Articles */}
      <div className="flex-1">
        

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full">
                <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                  <div className="p-6">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : categoryArticles.length > 0 ? (
          <div>
            {/* Simple grid layout like ArticleSection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryArticles.slice(0, 3).map((article) => (
                <div key={article.id} className="w-full">
                  <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer">
                    {/* Image placeholder */}
                    <div className="h-48 bg-gradient-to-br from-green-100 to-green-200 rounded-t-lg flex items-center justify-center">
                      {article.imageUrl ? (
                        <img 
                          src={article.imageUrl} 
                          alt={article.title}
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      ) : (
                        <div className="text-green-600 text-4xl font-bold">
                          {article.title.charAt(0)}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {article.title}
                      </h3>
                      
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {article.content}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-500 text-xs">
                          <Clock className="w-4 h-4 mr-1" />
                          {new Date(article.createdAt.toString()).toLocaleDateString("vi-VN")}
                        </div>
                        
                        <span className="text-green-600 hover:text-green-700 text-sm font-medium">
                          Đọc thêm →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* View more articles link */}
            <div className="pt-6 text-center">
              <Link href={service.route}>
                <button className="inline-flex items-center text-primary font-medium hover:text-primary/80 transition-colors">
                  <span>Xem thêm bài viết về {getCategoryLabel(category)}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Chưa có bài viết nào cho mục này</p>
          </div>
        )}
      </div>
    </div>
  );
}