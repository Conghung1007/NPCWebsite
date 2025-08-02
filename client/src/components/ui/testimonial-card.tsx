import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { Star, Edit } from "lucide-react";

interface TestimonialCardProps {
  name: string;
  role: string;
  content: string;
  avatar?: string;
  rating?: number;
  allowAvatarEdit?: boolean;
  onAvatarUpdate?: (newAvatar: string) => void;
}

export function TestimonialCard({ 
  name, 
  role, 
  content, 
  avatar,
  rating = 5,
  allowAvatarEdit = false,
  onAvatarUpdate
}: TestimonialCardProps) {
  const [showImageManager, setShowImageManager] = useState(false);
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
            <div className="relative mr-4">
              <img 
                src={avatar} 
                alt={name}
                className="w-12 h-12 rounded-full object-cover" 
              />
              {allowAvatarEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImageManager(true)}
                  className="absolute -top-1 -right-1 w-6 h-6 p-0 bg-white/90 hover:bg-white text-gray-700 rounded-full"
                >
                  <Edit className="w-3 h-3" />
                </Button>
              )}
              {allowAvatarEdit && (
                <ImageManager
                  isOpen={showImageManager}
                  onClose={() => setShowImageManager(false)}
                  onImageUpdate={(newAvatar) => {
                    onAvatarUpdate?.(newAvatar);
                    setShowImageManager(false);
                  }}
                  imageType="testimonial"
                  altText={`${name} avatar`}
                />
              )}
            </div>
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
