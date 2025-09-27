import { X, Image as ImageIcon, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MultipleImagePreviewBoxProps {
  imageUrls: string[];
  onRemove: (index: number) => void;
  onChooseImage: () => void;
  title: string;
  className?: string;
  maxImages?: number;
}

export function MultipleImagePreviewBox({ 
  imageUrls, 
  onRemove, 
  onChooseImage,
  title,
  className = "",
  maxImages = 5
}: MultipleImagePreviewBoxProps) {
  const canAddMore = imageUrls.length < maxImages;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Images Grid */}
      {imageUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {imageUrls.map((imageUrl, index) => (
            <div
              key={index}
              className="relative bg-white rounded-lg border overflow-hidden group hover:shadow-md transition-all"
              style={{ aspectRatio: '1' }}
            >
              <img
                src={imageUrl}
                alt={`${title} ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div 
                className="w-full h-full bg-gray-100 hidden items-center justify-center absolute inset-0"
                style={{ display: 'none' }}
              >
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
              
              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onRemove(index);
                }}
                className="absolute top-1 right-1 w-6 h-6 p-0 bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-remove-image-${index}`}
              >
                <X className="w-3 h-3" />
              </Button>
              
              {/* Image counter */}
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add more button */}
      {canAddMore && (
        <div
          className="bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20 h-20 w-full flex items-center gap-3 px-4 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={onChooseImage}
        >
          <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
            {imageUrls.length === 0 ? (
              <Upload className="w-6 h-6 text-gray-400" />
            ) : (
              <Plus className="w-6 h-6 text-gray-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {imageUrls.length === 0 ? title : `Thêm ${title.toLowerCase()}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {imageUrls.length === 0 
                ? "Click để chọn hình ảnh" 
                : `${imageUrls.length}/${maxImages} hình ảnh`
              }
            </p>
          </div>
        </div>
      )}

      {/* Max limit reached message */}
      {!canAddMore && (
        <p className="text-xs text-muted-foreground text-center">
          Đã đạt giới hạn tối đa {maxImages} hình ảnh
        </p>
      )}
    </div>
  );
}