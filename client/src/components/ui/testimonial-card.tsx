import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

interface TestimonialCardProps {
  name: string;
  role: string;
  content: string;
  avatar?: string;
  rating?: number;
}

export function TestimonialCard({ 
  name, 
  role, 
  content, 
  avatar,
  rating = 5 
}: TestimonialCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-8">
        <div className="flex items-center mb-4">
          <div className="flex text-accent">
            {[...Array(rating)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
        </div>
        <p className="text-muted-foreground mb-6 italic leading-relaxed">
          "{content}"
        </p>
        <div className="flex items-center">
          {avatar && (
            <img 
              src={avatar} 
              alt={name}
              className="w-12 h-12 rounded-full mr-4 object-cover" 
            />
          )}
          <div>
            <div className="font-semibold text-foreground">{name}</div>
            <div className="text-sm text-muted-foreground">{role}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
