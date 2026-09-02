import { useState } from "react";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { useUiImages } from "@/hooks/useUiImages";
import { useAuth } from "@/hooks/useAuth";
import { useContentEditMode } from "@/hooks/useContentEditMode";
import { cn } from "@/lib/utils";

type EditableContentImageProps = {
  imageType: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  aspectClassName?: string;
};

/** Section/content image slot editable by admin via ImageManager */
export function EditableContentImage({
  imageType,
  alt,
  className,
  imgClassName,
  aspectClassName = "aspect-[4/3]",
}: EditableContentImageProps) {
  const { getImageByType, invalidateCache } = useUiImages();
  const { hasImageEditPermission } = useAuth();
  const inlineEditEnabled = useContentEditMode();
  const canEditImages = hasImageEditPermission && inlineEditEnabled;
  const [override, setOverride] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const src = override ?? getImageByType(imageType);

  return (
    <div className={cn("relative overflow-hidden rounded-xl", aspectClassName, className)}>
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", imgClassName)}
        onError={(e) => {
          e.currentTarget.src =
            "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1200&q=80";
        }}
      />
      {canEditImages && (
        <div
          className="absolute top-3 right-3 z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-white/90"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }}
          >
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            Đổi ảnh
          </Button>
          <ImageManager
            isOpen={open}
            onClose={() => setOpen(false)}
            onImageUpdate={(url) => {
              setOverride(url);
              invalidateCache();
              setOpen(false);
            }}
            imageType={imageType}
            altText={alt}
          />
        </div>
      )}
    </div>
  );
}
