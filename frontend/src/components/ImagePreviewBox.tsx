import { X, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewBoxProps {
  imageUrl?: string;
  onRemove: () => void;
  onChooseImage: () => void;
  title: string;
  className?: string;
}

export function ImagePreviewBox({ 
  imageUrl, 
  onRemove, 
  onChooseImage,
  title,
  className = ""
}: ImagePreviewBoxProps) {
  return (
    <div className={`bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20 h-20 w-full flex items-center gap-3 px-4 cursor-pointer hover:bg-muted/40 transition-colors ${className}`} onClick={onChooseImage}>
      {imageUrl ? (
        <>
          {/* Image preview */}
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded border overflow-hidden">
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Show icon on error
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const icon = target.nextElementSibling as HTMLElement;
                if (icon) icon.style.display = 'flex';
              }}
            />
            <div 
              className="w-full h-full bg-gray-100 hidden items-center justify-center"
              style={{ display: 'none' }}
            >
              <ImageIcon className="w-6 h-6 text-gray-400" />
            </div>
          </div>

          {/* Title and URL */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {imageUrl.split('/').pop() || 'Ảnh đã tải lên'}
            </p>
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex-shrink-0 w-8 h-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            data-testid="button-remove-image"
          >
            <X className="w-4 h-4" />
          </Button>
        </>
      ) : (
        <>
          {/* Upload icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
            <Upload className="w-6 h-6 text-gray-400" />
          </div>

          {/* Title and instruction */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {title}
            </p>
            <p className="text-xs text-muted-foreground">
              Click để chọn hình ảnh
            </p>
          </div>
        </>
      )}
    </div>
  );
}