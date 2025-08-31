import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { EditableText } from "@/components/ui/editable-text";
import { Star, Edit } from "lucide-react";

interface TestimonialCardProps {
  id: number;
  name: string;
  role: string;
  content: string;
  avatar?: string;
  rating?: number;
  allowAvatarEdit?: boolean;
  onAvatarUpdate?: (newAvatar: string) => void;
  allowTextEdit?: boolean;
  onTextUpdate?: (field: string, value: string) => void;
  editingField?: string | null;
  editValues?: Record<string, string>;
  onEditStart?: (fieldName: string, currentValue: string) => void;
  onEditSave?: (fieldName: string, value: string) => void;
  onEditCancel?: () => void;
}

export function TestimonialCard({ 
  id,
  name, 
  role, 
  content, 
  avatar,
  rating = 5,
  allowAvatarEdit = false,
  onAvatarUpdate,
  allowTextEdit = false,
  onTextUpdate,
  editingField,
  editValues,
  onEditStart,
  onEditSave,
  onEditCancel
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
          "<EditableText 
            fieldName={`testimonial-${id}-content`}
            text={content}
            className="text-muted-foreground italic"
            multiline={true}
            showEditButton={allowTextEdit}
            editingField={editingField}
            editValues={editValues}
            onEditStart={onEditStart}
            onEditSave={onEditSave}
            onEditCancel={onEditCancel}
          />"
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
            <div className="font-semibold text-foreground">
              <EditableText 
                fieldName={`testimonial-${id}-name`}
                text={name}
                className="font-semibold text-foreground"
                showEditButton={allowTextEdit}
                editingField={editingField}
                editValues={editValues}
                onEditStart={onEditStart}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <EditableText 
                fieldName={`testimonial-${id}-role`}
                text={role}
                className="text-sm text-muted-foreground"
                showEditButton={allowTextEdit}
                editingField={editingField}
                editValues={editValues}
                onEditStart={onEditStart}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
