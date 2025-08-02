import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { Article } from "@shared/schema";

interface ServiceWithArticlesProps {
  service: {
    icon: React.ReactNode;
    title: string;
    description: string;
    route: string;
  };
  category: string;
  isReversed?: boolean;
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
  isReversed = false, 
  onServiceClick 
}: ServiceWithArticlesProps) {
  const { data: allArticles = [], isLoading } = useQuery<Article[]>({
    queryKey: ['/api/articles'],
  });

  // Filter articles by category and take first 3
  const categoryArticles = allArticles
    .filter(article => article.category === category)
    .slice(0, 3);

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
    <div className={`flex flex-col lg:flex-row items-start gap-8 ${isReversed ? 'lg:flex-row-reverse' : ''}`}>
      {/* Service Info */}
      <div className="flex-1 lg:max-w-md">
        <div className="bg-white rounded-xl p-8 shadow-lg h-fit pt-[51px] pb-[51px]">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
            {service.icon}
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-4">{service.title}</h3>
          <p className="text-lg text-muted-foreground mb-6">{service.description}</p>
          <Button onClick={onServiceClick} className="w-full">
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
              <Card key={i} className="overflow-hidden">
                <div className="w-full h-48 bg-gray-200 animate-pulse"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : categoryArticles.length > 0 ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryArticles.map((article) => (
                <Card 
                  key={article.id}
                  className="overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer"
                >
                  <div className="relative w-full h-48 overflow-hidden">
                    <img
                      src={article.imageUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=300&fit=crop'}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className={getCategoryColor(category)}>
                        {getCategoryLabel(category)}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>{new Date(article.createdAt || Date.now()).toLocaleDateString('vi-VN')}</span>
                    </div>
                    
                    <h5 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h5>
                    
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {article.content.substring(0, 120)}...
                    </p>
                  </CardContent>
                </Card>
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