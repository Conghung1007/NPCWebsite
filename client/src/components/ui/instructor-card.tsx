import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { Edit } from "lucide-react";

interface InstructorCardProps {
  name: string;
  title: string;
  description: string;
  avatar: string;
  allowAvatarEdit?: boolean;
  onAvatarUpdate?: (newAvatar: string) => void;
}

export function InstructorCard({ 
  name, 
  title, 
  description, 
  avatar,
  allowAvatarEdit = false,
  onAvatarUpdate
}: InstructorCardProps) {
  const [showImageManager, setShowImageManager] = useState(false);
  
  return (
    <Card className="text-center">
      <CardContent className="p-6">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <img 
            src={avatar} 
            alt={name}
            className="w-24 h-24 rounded-full object-cover" 
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
              imageType={`instructor-${name.toLowerCase().replace(/\s+/g, '-')}`}
              altText={`${name} avatar`}
            />
          )}
        </div>
        <h4 className="font-semibold text-foreground mb-2">{name}</h4>
        <p className="text-accent text-sm mb-3">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}