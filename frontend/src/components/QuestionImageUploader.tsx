import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuestionImageUploaderProps {
  onImageUpload: (imageUrl: string) => void;
  currentImageUrl?: string;
  onRemoveImage?: () => void;
  disabled?: boolean;
  type: "question" | "answer";
  maxSizeMB?: number;
  label?: string;
  context?: "qbank" | "exam";
}

export function QuestionImageUploader({ 
  onImageUpload, 
  currentImageUrl, 
  onRemoveImage, 
  disabled = false,
  type = "question",
  maxSizeMB = 5,
  label,
  context = "qbank"
}: QuestionImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const apiEndpoint = type === "question" ? "/api/question-images/upload-direct" : "/api/answer-images/upload-direct";
  const cleanupEndpoint = type === "question" ? "/api/temp-question-images/cleanup" : "/api/temp-answer-images/cleanup";
  const formFieldName = type === "question" ? "file" : "image";

  const isTempUploadedUrl = (url: string) => {
    if (type === "question") {
      return (
        /\/api\/(qbank|exam)-temp-images\//.test(url) ||
        url.includes("/api/temp-question-images/")
      );
    }
    return (
      /\/api\/(qbank|exam)-temp-answer-images\//.test(url) ||
      url.includes("/api/temp-answer-images/")
    );
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file hình ảnh hợp lệ",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Lỗi", 
        description: `File hình ảnh không được vượt quá ${maxSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Cleanup previous temporary file if exists
      if (currentImageUrl && isTempUploadedUrl(currentImageUrl)) {
        try {
          const oldFilename = currentImageUrl.split('/').pop();
          if (oldFilename) {
            const contextMatch = currentImageUrl.match(/\/api\/(qbank|exam)-temp-/);
            const fileContext = contextMatch ? contextMatch[1] : undefined;
            const cleanupUrl = fileContext ? `${cleanupEndpoint}?context=${fileContext}` : cleanupEndpoint;
            
            fetch(cleanupUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filenames: [oldFilename] })
            }).catch(e => console.warn("Failed to cleanup old temp file:", e));
          }
        } catch (error) {
          console.warn("Failed to cleanup old temporary image file:", error);
        }
      }

      // Use direct upload via server (question → field "file", answer → field "image")
      const formData = new FormData();
      formData.append(formFieldName, file);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        setIsUploading(false);
        setUploadProgress(0);
        
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            const imageUrl = response.imageUrl || response.url;
            
            onImageUpload(imageUrl);
            toast({
              title: "Thành công", 
              description: "Upload hình ảnh thành công",
            });
          } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            toast({
              title: "Lỗi",
              description: "Phản hồi từ server không hợp lệ",
              variant: "destructive",
            });
          }
        } else {
          let errorMessage = `Upload thất bại (Mã lỗi: ${xhr.status})`;
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            if (errorResponse.message) {
              errorMessage = errorResponse.message;
            }
          } catch {
            // Use default error message
          }
          
          toast({
            title: "Lỗi",
            description: errorMessage,
            variant: "destructive",
          });
        }
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });

      xhr.addEventListener('error', () => {
        setIsUploading(false);
        setUploadProgress(0);
        
        toast({
          title: "Lỗi",
          description: "Lỗi mạng - Không thể upload file",
          variant: "destructive",
        });
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });

      const endpointWithContext = `${apiEndpoint}?context=${context}`;
      xhr.open('POST', endpointWithContext);
      xhr.send(formData);

    } catch (error) {
      console.error('Image upload error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể upload file hình ảnh",
        variant: "destructive",
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!currentImageUrl || !onRemoveImage) return;

    if (isTempUploadedUrl(currentImageUrl)) {
      try {
        const filename = currentImageUrl.split('/').pop();
        if (filename) {
          const contextMatch = currentImageUrl.match(/\/api\/(qbank|exam)-temp-/);
          const fileContext = contextMatch ? contextMatch[1] : undefined;
          const cleanupUrl = fileContext ? `${cleanupEndpoint}?context=${fileContext}` : cleanupEndpoint;
          
          await fetch(cleanupUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filenames: [filename] })
          });
        }
      } catch (error) {
        console.warn("Failed to cleanup temporary image file:", error);
      }
    }

    onRemoveImage();
    toast({
      title: "Đã xóa",
      description: "Hình ảnh đã được xóa",
    });
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
        {currentImageUrl ? (
          <div className="space-y-3">
            <div className="relative inline-block">
              <img 
                src={currentImageUrl} 
                alt="Uploaded image" 
                className="max-w-full max-h-48 object-contain rounded"
              />
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Thay đổi
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-gray-500">
              <Image className="w-12 h-12 mx-auto mb-2" />
              <p>Chọn hình ảnh để upload</p>
              <p className="text-xs">Định dạng: JPG, PNG, GIF, WebP (tối đa {maxSizeMB}MB)</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? `Đang upload... ${uploadProgress}%` : "Chọn hình ảnh"}
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />
    </div>
  );
}