import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


interface ImageManagerProps {
  currentImageUrl?: string;
  onImageUpdate: (newImageUrl: string) => void;
  imageType: "hero" | "service" | "testimonial" | "feature" | "ui";
  altText?: string;
  className?: string;
}

export function ImageManager({
  currentImageUrl,
  onImageUpdate,
  imageType,
  altText = "Uploaded image",
  className = ""
}: ImageManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Lỗi",
        description: "Kích thước file không được vượt quá 10MB",
        variant: "destructive"
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Lỗi", 
        description: "Chỉ chấp nhận file hình ảnh",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      // Get upload URL for UI images folder
      const uploadResponse = await fetch(`/api/ui-images/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          imageType: imageType
        })
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const uploadData = await uploadResponse.json();

      // Upload file to R2
      const uploadResult = await fetch(uploadData.uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResult.ok) {
        throw new Error('Upload failed');
      }

      // Update image metadata
      const updateResponse = await fetch(`/api/ui-images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: uploadData.uploadURL.split('?')[0], // Remove query params
          imageType: imageType,
          altText: altText
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update image metadata');
      }

      const updateData = await updateResponse.json();
      onImageUpdate(updateData.imageUrl);
      setIsOpen(false);
      
      toast({
        title: "Thành công",
        description: "Hình ảnh đã được cập nhật"
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Lỗi",
        description: "Không thể upload hình ảnh",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpdate = async () => {
    if (!previewUrl.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập URL hình ảnh",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);
      
      const updateResponse = await fetch(`/api/ui-images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: previewUrl,
          imageType: imageType,
          altText: altText
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update image');
      }

      const updateData = await updateResponse.json();
      onImageUpdate(updateData.imageUrl);
      setIsOpen(false);
      setPreviewUrl("");
      
      toast({
        title: "Thành công", 
        description: "Hình ảnh đã được cập nhật"
      });

    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật hình ảnh",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`gap-2 ${className}`}
      >
        <Upload className="h-4 w-4" />
        Đổi hình ảnh
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cập nhật hình ảnh</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {currentImageUrl && (
              <div className="space-y-2">
                <Label>Hình ảnh hiện tại:</Label>
                <img 
                  src={currentImageUrl} 
                  alt={altText}
                  className="w-full h-32 object-cover rounded border"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload file mới:</Label>
              <Input
                id="file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </div>

            <div className="text-center text-muted-foreground">hoặc</div>

            <div className="space-y-2">
              <Label htmlFor="url-input">Nhập URL hình ảnh:</Label>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://..."
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  disabled={uploading}
                />
                {previewUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPreviewUrl("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {previewUrl && (
              <div className="space-y-2">
                <Label>Xem trước:</Label>
                <img 
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded border"
                  onError={() => {
                    toast({
                      title: "Lỗi",
                      description: "URL hình ảnh không hợp lệ",
                      variant: "destructive"
                    });
                  }}
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={previewUrl ? handleUrlUpdate : () => {}}
                disabled={uploading || (!previewUrl)}
                className="flex-1"
              >
                {uploading ? "Đang cập nhật..." : "Cập nhật"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  setPreviewUrl("");
                }}
                disabled={uploading}
              >
                Hủy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}