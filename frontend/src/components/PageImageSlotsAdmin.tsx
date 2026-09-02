import { useState } from "react";
import { ImageIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { useUiImages } from "@/hooks/useUiImages";
import type { PageContentEntry } from "@shared/pageContentRegistry";

type PageImageSlotsAdminProps = {
  page: PageContentEntry;
};

export function PageImageSlotsAdmin({ page }: PageImageSlotsAdminProps) {
  const { getExactImageByType, getImageByType, invalidateCache } = useUiImages(page.portal);
  const [activeSlot, setActiveSlot] = useState<{
    type: string;
    label: string;
  } | null>(null);

  if (page.imageSlots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Trang này không có slot ảnh cấu hình.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Quản lý banner và hình minh họa cho trang. Thay ảnh tại đây thay vì trên trang public.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {page.imageSlots.map((slot) => {
          const url = getExactImageByType(slot.type) || getImageByType(slot.type);
          return (
            <div
              key={slot.type}
              className="rounded-xl border border-neutral-200 overflow-hidden bg-white"
            >
              <div className="aspect-video bg-neutral-100 relative">
                {url ? (
                  <img
                    src={url}
                    alt={slot.label}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-neutral-400">
                    <ImageIcon className="h-10 w-10 opacity-40" />
                  </div>
                )}
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{slot.label}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {slot.type}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSlot(slot)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Đổi
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {activeSlot ? (
        <ImageManager
          isOpen
          onClose={() => setActiveSlot(null)}
          imageType={activeSlot.type}
          altText={activeSlot.label}
          portal={page.portal}
          onImageUpdate={() => {
            invalidateCache();
            setActiveSlot(null);
          }}
        />
      ) : null}
    </>
  );
}
