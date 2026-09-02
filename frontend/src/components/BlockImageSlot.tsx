import { useEffect, useState } from "react";
import { ImageIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { useUiImages } from "@/hooks/useUiImages";
import { cn } from "@/lib/utils";

type BlockImageSlotProps = {
  imageType: string;
  label: string;
  portal: string;
  className?: string;
  compact?: boolean;
  /** Use parent-level ImageManager (avoids nested dialogs in block editor) */
  onRequestEdit?: (slot: { imageType: string; label: string }) => void;
};

/** Inline CMS image slot — preview + edit trigger (used inside block editor forms). */
export function BlockImageSlot({
  imageType,
  label,
  portal,
  className,
  compact = false,
  onRequestEdit,
}: BlockImageSlotProps) {
  const { getExactImageByType, getImageByType, invalidateCache } =
    useUiImages(portal);
  const [open, setOpen] = useState(false);
  const [previewOverride, setPreviewOverride] = useState<string | null>(null);

  useEffect(() => {
    setPreviewOverride(null);
  }, [imageType, portal]);

  if (!imageType.trim()) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Nhập mã ảnh để hiện preview và đổi ảnh.
      </p>
    );
  }

  const exactUrl = getExactImageByType(imageType);
  const url = previewOverride || exactUrl || getImageByType(imageType, "");

  const handleUpdated = (newUrl: string) => {
    setPreviewOverride(newUrl);
    invalidateCache();
    setOpen(false);
  };

  const startEdit = () => {
    if (onRequestEdit) {
      onRequestEdit({ imageType, label });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "flex gap-3 rounded-lg border bg-muted/30 p-2",
          compact ? "items-center" : "items-start",
          className,
        )}
      >
        <div
          className={cn(
            "shrink-0 overflow-hidden rounded-md bg-neutral-100",
            compact ? "h-14 w-20" : "aspect-video w-full max-w-[140px]",
          )}
        >
          {url ? (
            <img
              src={url}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[3.5rem] items-center justify-center text-neutral-400">
              <ImageIcon className="h-6 w-6 opacity-50" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium leading-tight">{label}</p>
          <p className="text-[11px] font-mono text-muted-foreground truncate">
            {imageType}
          </p>
          {!exactUrl && !previewOverride && url ? (
            <p className="text-[10px] text-amber-700">
              Đang dùng ảnh thay thế — upload để gán riêng slot này.
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Đổi ảnh
          </Button>
        </div>
      </div>

      {!onRequestEdit && open ? (
        <ImageManager
          isOpen
          onClose={() => setOpen(false)}
          imageType={imageType}
          altText={label}
          portal={portal}
          onImageUpdate={handleUpdated}
        />
      ) : null}
    </>
  );
}

const HERO_SLIDE_COUNT = 5;

export function HeroBlockImageSlots({
  prefix,
  portal,
  onRequestEdit,
}: {
  prefix: string;
  portal: string;
  onRequestEdit?: (slot: { imageType: string; label: string }) => void;
}) {
  const base = prefix.trim() || "group";
  const slots = [
    { type: `${base}-hero`, label: "Banner chính (fallback)" },
    ...Array.from({ length: HERO_SLIDE_COUNT }, (_, i) => ({
      type: `${base}-hero-${i + 1}`,
      label: `Slide ${i + 1}`,
    })),
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ảnh hero / carousel</p>
      <p className="text-xs text-muted-foreground mb-2">
        Carousel dùng slide 1–5 nếu có; không có thì dùng banner chính. Prefix:{" "}
        <code className="font-mono">{base}</code>
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {slots.map((slot) => (
          <BlockImageSlot
            key={slot.type}
            imageType={slot.type}
            label={slot.label}
            portal={portal}
            compact
            onRequestEdit={onRequestEdit}
          />
        ))}
      </div>
    </div>
  );
}
