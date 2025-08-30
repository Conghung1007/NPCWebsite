import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, ChevronLeft, ChevronRight, Edit } from "lucide-react";
import { Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import type { Article } from "@shared/schema";
import { ImageManager } from "@/components/ui/image-manager";

interface ServiceWithArticlesProps {
  service: {
    icon: React.ReactNode;
    title: string;
    description: string;
    route: string;
    backgroundImage?: string;
  };
  category: string;
  onServiceClick: () => void;
  allowImageEdit?: boolean;
  onServiceImageUpdate?: (newImageUrl: string) => void;
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
  onServiceClick,
  allowImageEdit = false,
  onServiceImageUpdate
}: ServiceWithArticlesProps) {
  const { data: allArticles = [], isLoading } = useQuery<Article[]>({
    queryKey: ['/api/articles'],
  });

  // State for carousel
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showImageManager, setShowImageManager] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter articles by category and limit to 6 most recent
  const categoryArticles = allArticles
    .filter(article => article.category === category)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
  
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
    if (categoryArticles.length <= 3 || isHovered) return; // Don't auto-scroll if all articles fit or user is hovering

    const autoScrollInterval = setInterval(() => {
      setCurrentIndex(prev => {
        // If at the end, go back to beginning
        if (prev >= categoryArticles.length - 3) {
          return 0;
        }
        // Otherwise, go to next
        return prev + 1;
      });
    }, 30000); // 30 seconds

    return () => clearInterval(autoScrollInterval);
  }, [categoryArticles.length, isHovered]);

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
        <div className="relative bg-white rounded-xl p-8 shadow-lg h-[400px] flex flex-col justify-between overflow-hidden">
          {/* Background Image */}
          {service.backgroundImage && (
            <div className="absolute inset-0 opacity-5">
              <img 
                src={service.backgroundImage} 
                alt={`${service.title} background`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Image Manager Button */}
          {allowImageEdit && (
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImageManager(true)}
                className="bg-white/80 hover:bg-white/90 text-gray-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Cập nhật ảnh
              </Button>
              <ImageManager
                isOpen={showImageManager}
                onClose={() => setShowImageManager(false)}
                onImageUpdate={(newImageUrl) => onServiceImageUpdate?.(newImageUrl)}
                imageType="service"
                altText={`${service.title} background image`}
              />
            </div>
          )}

          <div className="relative z-10">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
              {service.icon}
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-4">{service.title}</h3>
            <p className="text-lg text-muted-foreground mb-6">{service.description}</p>
          </div>
          <Button onClick={onServiceClick} className="relative z-10 w-full mt-auto">
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
                  <div className="h-44 bg-gray-200 rounded-t-lg"></div>
                  <div className="p-5">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : categoryArticles.length > 0 ? (
          <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Navigation buttons - only show if more than 3 articles */}
            {categoryArticles.length > 3 && (
              <>
                <button
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                  className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  onClick={goToNext}
                  disabled={currentIndex >= categoryArticles.length - 3}
                  className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </>
            )}

            {/* Grid layout with sliding window - keep same grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryArticles.slice(currentIndex, currentIndex + 3).map((article) => (
                <div key={article.id} className="w-full h-full flex">
                  <Link href={`/article/${article.id}`} className="w-full h-full">
                    <div className="w-full h-full bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer flex flex-col">
                      {/* Image placeholder */}
                      <div className="h-44 bg-gradient-to-br from-green-100 to-green-200 rounded-t-lg flex items-center justify-center flex-shrink-0">
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
                      
                      <div className="p-5 flex flex-col flex-grow">
                        <Badge className={getCategoryColor(category)}>
                          {getCategoryLabel(category)}
                        </Badge>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2 mt-2">
                          {article.title}
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                          {article.content}
                        </p>
                        
                        <div className="flex items-center justify-between mt-auto">
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
                  </Link>
                </div>
              ))}
            </div>

            {/* Dots indicator - only show if more than 3 articles */}
            {categoryArticles.length > 3 && (
              <div className="flex justify-center space-x-2 mt-6">
                {Array.from({ length: Math.max(1, categoryArticles.length - 2) }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                      index === currentIndex ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}
            
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