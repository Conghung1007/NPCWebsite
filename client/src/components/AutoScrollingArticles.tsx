import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { Article } from "@shared/schema";

// Simple Badge component since we don't have it in ui
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

interface AutoScrollingArticlesProps {
  title?: string;
  description?: string;
}

export function AutoScrollingArticles({ 
  title = "Bài viết mới nhất",
  description = "Cập nhật thông tin hữu ích từ N&P"
}: AutoScrollingArticlesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ['/api/articles'],
  });

  // Auto scroll every 10 seconds
  useEffect(() => {
    if (articles.length <= 3) return; // No need to scroll if we have 3 or fewer articles

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % (articles.length - 2));
        setIsAnimating(false);
      }, 500); // Animation duration
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [articles.length]);

  const getVisibleArticles = () => {
    if (articles.length === 0) return [];
    if (articles.length <= 3) return articles;
    
    const visible = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentIndex + i) % articles.length;
      visible.push(articles[index]);
    }
    return visible;
  };

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

  if (isLoading) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
            <p className="text-xl text-gray-600">{description}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="h-48 bg-gray-200 animate-pulse"></div>
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
                  <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const visibleArticles = getVisibleArticles();

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
          <p className="text-xl text-gray-600">{description}</p>
        </div>

        {/* Auto-scrolling articles container */}
        <div className="relative overflow-hidden">
          <div 
            className={`grid md:grid-cols-3 gap-6 transition-all duration-500 ease-in-out ${
              isAnimating ? 'transform -translate-x-full opacity-0' : 'transform translate-x-0 opacity-100'
            }`}
          >
            {visibleArticles.map((article) => (
              <Card 
                key={`${article.id}-${currentIndex}`}
                className="overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={article.imageUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=300&fit=crop'}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className={getCategoryColor(article.category)}>
                      {getCategoryLabel(article.category)}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{new Date(article.createdAt || Date.now()).toLocaleDateString('vi-VN')}</span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {article.content.substring(0, 150)}...
                  </p>
                  
                  <div className="flex items-center text-primary font-medium group-hover:text-primary/80 transition-colors">
                    <span>Đọc thêm</span>
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dots indicator */}
        {articles.length > 3 && (
          <div className="flex justify-center mt-8 space-x-2">
            {Array.from({ length: Math.max(0, articles.length - 2) }).map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsAnimating(true);
                  setTimeout(() => {
                    setCurrentIndex(index);
                    setIsAnimating(false);
                  }, 500);
                }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-primary scale-125' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}

        {/* View all articles button */}
        <div className="text-center mt-12">
          <button className="inline-flex items-center px-6 py-3 border border-primary text-primary font-medium rounded-lg hover:bg-primary hover:text-white transition-all duration-300">
            <span>Xem tất cả bài viết</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </section>
  );
}