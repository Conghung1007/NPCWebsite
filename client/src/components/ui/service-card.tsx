import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ServiceCardProps {
  icon?: ReactNode;
  title: string;
  description: string;
  onLearnMore?: () => void;
  className?: string;
}

export function ServiceCard({ 
  icon, 
  title, 
  description, 
  onLearnMore, 
  className = "" 
}: ServiceCardProps) {
  return (
    <Card className={`service-card-hover ${className}`}>
      <CardContent className="p-8 text-center group">
        {icon && (
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
            {icon}
          </div>
        )}
        <h3 className="text-xl font-semibold text-foreground mb-4">{title}</h3>
        <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>
        {onLearnMore && (
          <Button 
            onClick={onLearnMore}
            variant="ghost" 
            className="text-primary font-semibold hover:text-primary/80 p-0"
          >
            Tìm hiểu thêm <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
