import { Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import type { Article } from "@shared/schema";
import {
  getArticleCoverUrl,
  getArticlePlainPreview,
} from "@/lib/articleContent";

interface ArticleCardProps {
  article: Article;
  onClick?: () => void;
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  const [, setLocation] = useLocation();
  const coverUrl = getArticleCoverUrl(article);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(coverUrl) && !imageFailed;
  const preview = getArticlePlainPreview(article.content);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setLocation(`/article/${article.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="w-full h-full flex flex-col overflow-hidden rounded-xl border border-border/70 bg-white hover:border-primary/40 hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-[16/10] bg-gradient-to-br from-primary/15 via-primary/5 to-secondary overflow-hidden">
        {showImage ? (
          <img
            src={coverUrl!}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-5 text-center">
            <p className="font-display text-lg sm:text-xl font-semibold text-primary/80 line-clamp-4 leading-snug">
              {article.title}
            </p>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-base font-semibold text-foreground mb-2 line-clamp-2">
          {article.title}
        </h3>

        {preview ? (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1 leading-relaxed">
            {preview}
          </p>
        ) : (
          <div className="flex-1 mb-4" />
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center text-muted-foreground text-xs">
            <Calendar className="w-3.5 h-3.5 mr-1.5" aria-hidden />
            <time dateTime={article.createdAt.toString()}>
              {formatDate(article.createdAt.toString())}
            </time>
          </div>

          <span className="text-primary text-sm font-semibold">Đọc thêm →</span>
        </div>
      </div>
    </article>
  );
}
