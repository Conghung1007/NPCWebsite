import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { EditableText } from "@/components/ui/editable-text";
import { Star, Edit } from "lucide-react";

interface TestimonialCardProps {
  id: string;
  name: string;
  role: string;
  content: string;
  avatar?: string | null;
  rating?: number;
  allowAvatarEdit?: boolean;
  onAvatarUpdate?: (newAvatar: string) => void;
  allowTextEdit?: boolean;
  editingField?: string | null;
  editValues?: Record<string, string>;
  onEditStart?: (fieldName: string, currentValue: string) => void;
  onEditSave?: (fieldName: string, value: string) => void;
  onEditCancel?: () => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  editingField,
  editValues,
  onEditStart,
  onEditSave,
  onEditCancel,
}: TestimonialCardProps) {
  const [showImageManager, setShowImageManager] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const showPhoto = Boolean(avatar) && !avatarBroken;

  return (
    <figure className="h-full flex flex-col border-t-2 border-primary/30 pt-6">
      <div className="flex text-accent mb-4" aria-label={`${rating} sao`}>
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </div>

      <blockquote className="text-muted-foreground mb-6 leading-relaxed flex-1">
        <span className="sr-only">Trích dẫn: </span>
        <EditableText
          fieldName={`testimonial:${id}:content`}
          text={content}
          className="text-muted-foreground"
          multiline
          showEditButton={allowTextEdit}
          editingField={editingField}
          editValues={editValues}
          onEditStart={onEditStart}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
        />
      </blockquote>

      <figcaption className="flex items-center gap-3">
        <div className="relative shrink-0">
          {showPhoto ? (
            <img
              src={avatar!}
              alt=""
              className="w-11 h-11 rounded-full object-cover"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold"
              aria-hidden
            >
              {getInitials(name)}
            </div>
          )}
          {allowAvatarEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImageManager(true)}
                className="absolute -top-1 -right-1 w-6 h-6 p-0 bg-white/90 hover:bg-white text-foreground rounded-full"
                aria-label={`Cập nhật ảnh ${name}`}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <ImageManager
                isOpen={showImageManager}
                onClose={() => setShowImageManager(false)}
                onImageUpdate={(newAvatar) => {
                  setAvatarBroken(false);
                  onAvatarUpdate?.(newAvatar);
                  setShowImageManager(false);
                }}
                imageType="testimonial"
                altText={`${name} avatar`}
              />
            </>
          )}
        </div>
        <div>
          <div className="font-semibold text-foreground">
            <EditableText
              fieldName={`testimonial:${id}:name`}
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
              fieldName={`testimonial:${id}:role`}
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
      </figcaption>
    </figure>
  );
}
