import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Edit, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { useUiImages } from "@/hooks/useUiImages";
import { useAuth } from "@/hooks/useAuth";
import { useContentEditMode } from "@/hooks/useContentEditMode";
import { cn } from "@/lib/utils";

const MAX_SLIDES = 5;

type EditableHeroCarouselProps = {
  /** Base prefix, e.g. "japanese" → japanese-hero-1 … + fallback japanese-hero */
  imageTypePrefix: string;
  altPrefix?: string;
  className?: string;
  minHeightClassName?: string;
  overlayClassName?: string;
  autoplayMs?: number;
  children?: React.ReactNode;
};

/**
 * Full-bleed hero carousel. Slides are ui_images:
 * `{prefix}-hero-1` … `{prefix}-hero-5`, fallback `{prefix}-hero`.
 * Admin: đổi từng slide / thêm ảnh (tối đa 5).
 */
export function EditableHeroCarousel({
  imageTypePrefix,
  altPrefix = "Hero",
  className,
  minHeightClassName = "min-h-[calc(78svh-var(--header-height))]",
  overlayClassName,
  autoplayMs = 6000,
  children,
}: EditableHeroCarouselProps) {
  const { getImageByType, invalidateCache, uiImages } = useUiImages();
  const { hasImageEditPermission } = useAuth();
  const inlineEditEnabled = useContentEditMode();
  const canEditImages = hasImageEditPermission && inlineEditEnabled;
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [managerType, setManagerType] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);

  const fallbackType = `${imageTypePrefix}-hero`;
  const slideTypes = useMemo(
    () =>
      Array.from(
        { length: MAX_SLIDES },
        (_, i) => `${imageTypePrefix}-hero-${i + 1}`,
      ),
    [imageTypePrefix],
  );

  const hasExactType = useCallback(
    (type: string) => {
      if (overrides[type]) return true;
      return !!uiImages?.some((img) => img.imageType === type && img.imageUrl);
    },
    [overrides, uiImages],
  );

  const slides = useMemo(() => {
    const dedicated = slideTypes
      .map((type, i) => ({
        type,
        index: i + 1,
        url: overrides[type] ?? getImageByType(type),
      }))
      .filter((s) => hasExactType(s.type));

    if (dedicated.length > 0) return dedicated;

    return [
      {
        type: fallbackType,
        index: 1,
        url: overrides[fallbackType] ?? getImageByType(fallbackType),
      },
    ];
  }, [
    slideTypes,
    overrides,
    getImageByType,
    hasExactType,
    fallbackType,
  ]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 25 });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    emblaApi?.reInit();
  }, [emblaApi, slides.length]);

  useEffect(() => {
    if (!emblaApi || slides.length < 2 || !autoplayMs) return;
    const id = window.setInterval(() => emblaApi.scrollNext(), autoplayMs);
    return () => window.clearInterval(id);
  }, [emblaApi, slides.length, autoplayMs]);

  return (
    <section
      className={cn(
        "relative text-white overflow-hidden flex items-center",
        minHeightClassName,
        className,
      )}
    >
      <div className="absolute inset-0" ref={emblaRef}>
        <div className="flex h-full min-h-[inherit]">
          {slides.map((slide) => (
            <div
              key={slide.type}
              className="relative min-w-0 flex-[0_0_100%] min-h-[calc(78svh-var(--header-height))]"
            >
              <img
                src={slide.url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=2092&q=80";
                }}
              />
            </div>
          ))}
        </div>
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70",
            overlayClassName,
          )}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[hsl(152,72%,18%)]/50 via-transparent to-transparent" />
      </div>

      {canEditImages && (
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2 max-w-md">
            {slides.map((slide) => (
              <Button
                key={slide.type}
                variant="outline"
                size="sm"
                onClick={() => setManagerType(slide.type)}
                className="bg-white/20 text-white hover:bg-white/30 border-white/50"
              >
                <Edit className="w-3.5 h-3.5 mr-1.5" />
                {slide.type === fallbackType ? "Ảnh nền" : `Slide ${slide.index}`}
              </Button>
            ))}
            {slides.length < MAX_SLIDES && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const used = new Set(slides.map((s) => s.type));
                  const next = slideTypes.find((t) => !used.has(t));
                  if (next) setManagerType(next);
                }}
                className="bg-white/20 text-white hover:bg-white/30 border-white/50"
              >
                <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                Thêm ảnh trượt
              </Button>
            )}
          </div>
          {managerType && (
            <ImageManager
              isOpen={!!managerType}
              onClose={() => setManagerType(null)}
              onImageUpdate={(url) => {
                setOverrides((prev) => ({ ...prev, [managerType]: url }));
                invalidateCache();
                setManagerType(null);
              }}
              imageType={managerType}
              altText={`${altPrefix} ${managerType}`}
            />
          )}
        </div>
      )}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Ảnh trước"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/50 hidden sm:flex"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Ảnh sau"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/50 hidden sm:flex"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-5 left-0 right-0 z-10 flex justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.type}
                type="button"
                aria-label={`Tới slide ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === selected ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80",
                )}
                onClick={() => emblaApi?.scrollTo(i)}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative z-[1] w-full pointer-events-none">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </section>
  );
}
