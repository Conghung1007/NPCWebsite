import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { Edit } from "lucide-react";

interface InstructorCardProps {
  name: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** Plain name for initials / alt when photo missing */
  nameLabel?: string;
  avatar?: string | null;
  allowAvatarEdit?: boolean;
  onAvatarUpdate?: (newAvatar: string) => void;
  imageType?: string;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function InstructorCard({
  name,
  title,
  description,
  nameLabel,
  avatar,
  allowAvatarEdit = false,
  onAvatarUpdate,
  imageType = "instructor",
}: InstructorCardProps) {
  const [showImageManager, setShowImageManager] = useState(false);
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(avatar) && !broken;
  const label =
    nameLabel || (typeof name === "string" ? name : "Giảng viên");

  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-4">
        {showPhoto ? (
          <img
            src={avatar!}
            alt=""
            className="w-24 h-24 rounded-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold"
            aria-hidden
          >
            {getInitials(label)}
          </div>
        )}
        {allowAvatarEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImageManager(true)}
              className="absolute -top-1 -right-1 w-6 h-6 p-0 bg-white/90 hover:bg-white text-foreground rounded-full"
              aria-label={`Cập nhật ảnh ${label}`}
            >
              <Edit className="w-3 h-3" />
            </Button>
            <ImageManager
              isOpen={showImageManager}
              onClose={() => setShowImageManager(false)}
              onImageUpdate={(url) => {
                setBroken(false);
                onAvatarUpdate?.(url);
                setShowImageManager(false);
              }}
              imageType={imageType}
              altText={`${label} avatar`}
            />
          </>
        )}
      </div>
      <h4 className="font-semibold text-foreground mb-1">{name}</h4>
      <p className="text-sm text-primary mb-2">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
