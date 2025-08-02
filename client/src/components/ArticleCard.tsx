import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Calendar } from "lucide-react";
import type { Article } from "@shared/schema";

interface ArticleCardProps {
  article: Article;
  onClick: () => void;
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  return (
    <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300" onClick={onClick}>
      <CardContent className="p-0">
        {/* Image placeholder */}
        <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg flex items-center justify-center">
          {article.imageUrl ? (
            <img 
              src={article.imageUrl} 
              alt={article.title}
              className="w-full h-full object-cover rounded-t-lg"
            />
          ) : (
            <div className="text-primary/60 text-4xl font-bold">
              {article.title.charAt(0)}
            </div>
          )}
        </div>
        
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors overflow-hidden text-ellipsis" 
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
            {article.title}
          </h3>
          
          <p className="text-gray-600 text-sm mb-4 overflow-hidden text-ellipsis"
             style={{
               display: '-webkit-box',
               WebkitLineClamp: 3,
               WebkitBoxOrient: 'vertical'
             }}>
            {article.content}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-500 text-xs">
              <Calendar className="w-4 h-4 mr-1" />
              {formatDate(article.createdAt)}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="text-primary hover:text-primary/80 p-0 h-auto font-medium"
            >
              Đọc thêm →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}