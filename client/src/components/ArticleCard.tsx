import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import type { Article } from "@shared/schema";

interface ArticleCardProps {
  article: Article;
  onClick?: () => void;
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap = {
      'visa-services': 'Dịch vụ visa',
      'study-abroad': 'Du học',
      'japanese-training': 'Tiếng Nhật',
      'flight-tickets': 'Vé máy bay'
    };
    return categoryMap[category as keyof typeof categoryMap] || category;
  };

  return (
    <Card 
      className="h-full hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      {article.imageUrl && (
        <div className="aspect-video overflow-hidden rounded-t-lg">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-xs">
            {getCategoryLabel(article.category)}
          </Badge>
          <div className="flex items-center text-muted-foreground text-xs">
            <Calendar className="w-3 h-3 mr-1" />
            {formatDate(article.createdAt)}
          </div>
        </div>
        <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm line-clamp-3">
          {article.content}
        </p>
      </CardContent>
    </Card>
  );
}