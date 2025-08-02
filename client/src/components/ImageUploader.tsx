import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  onImageUploaded: (imageUrl: string, altText?: string) => void;
  triggerButton?: React.ReactNode;
  insertAtCursor?: boolean;
}

export function ImageUploader({ onImageUploaded, triggerButton, insertAtCursor = false }: ImageUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [altText, setAltText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file hình ảnh (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Lỗi",
        description: "Kích thước file không được vượt quá 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get upload URL
      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, imageUrl } = await uploadResponse.json();

      // Upload file to storage
      const uploadFileResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadFileResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Call callback with image URL and close dialog
      onImageUploaded(imageUrl, altText);
      
      // Reset form
      setAltText("");
      setIsOpen(false);
      
      toast({
        title: "Thành công",
        description: "Hình ảnh đã được tải lên thành công!",
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi tải lên hình ảnh",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Tải lên hình ảnh"
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tải lên hình ảnh</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <strong>💡 Mẹo:</strong> Sau khi tải lên, bạn sẽ có thể nhập mô tả và chọn vị trí chèn hình ảnh vào bài viết.
          </div>
          
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-gray-600">Đang tải lên...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Image className="h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Kéo thả hình ảnh vào đây hoặc{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={openFileDialog}
                  >
                    chọn file
                  </button>
                </p>
                <p className="text-xs text-gray-500">
                  Hỗ trợ JPG, PNG, GIF, WebP (tối đa 5MB)
                </p>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Alt text input */}
          <div>
            <label className="text-sm font-medium">Mô tả hình ảnh (tuỳ chọn)</label>
            <Input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Nhập mô tả cho hình ảnh..."
              className="mt-1"
              disabled={isUploading}
            />
          </div>

          {/* Manual upload button */}
          <Button
            type="button"
            onClick={openFileDialog}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tải lên...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Chọn file từ máy tính
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}