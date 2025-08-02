import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import type { Article } from "@shared/schema";

interface ArticleCardProps {
  article: Article;
  onClick: () => void;
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  console.log('ArticleCard rendering:', article.title);
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer" onClick={onClick}>
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
            <Calendar className="w-4 h-4 mr-1" />
            {formatDate(article.createdAt.toString())}
          </div>
          
          <span className="text-green-600 hover:text-green-700 text-sm font-medium">
            Đọc thêm →
          </span>
        </div>
      </div>
    </div>
  );
}