import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, X, Play, Pause, Volume2 } from "lucide-react";

interface DescriptionMediaUploaderProps {
  imageUrl?: string;
  audioUrl?: string;
  onImageChange: (url: string) => void;
  onAudioChange: (url: string) => void;
  disabled?: boolean;
  context?: "qbank" | "exam";
}

export function DescriptionMediaUploader({
  imageUrl = "",
  audioUrl = "",
  onImageChange,
  onAudioChange,
  disabled = false,
  context = "qbank"
}: DescriptionMediaUploaderProps) {
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isAudioUploading, setIsAudioUploading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const { toast } = useToast();

  const cleanupPreviousFile = useCallback(async (currentUrl: string, cleanupEndpoint: string) => {
    // Check for both legacy (/api/temp-*) and context-based (/api/{context}-temp-*) URLs
    const isTempFile = currentUrl && (
      currentUrl.includes('/api/temp-') || 
      currentUrl.match(/\/api\/(qbank|exam)-temp-/)
    );
    
    if (isTempFile) {
      try {
        const filename = currentUrl.split('/').pop();
        if (filename) {
          // Extract context from URL if present (e.g., /api/qbank-temp-images/ or /api/exam-temp-audio/)
          const contextMatch = currentUrl.match(/\/api\/(qbank|exam)-temp-/);
          const fileContext = contextMatch ? contextMatch[1] : undefined;
          const cleanupUrl = fileContext ? `${cleanupEndpoint}?context=${fileContext}` : cleanupEndpoint;
          
          fetch(cleanupUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filenames: [filename] })
          }).catch(e => console.warn("Failed to cleanup old temp file:", e));
        }
      } catch (error) {
        console.warn("Failed to cleanup old temporary file:", error);
      }
    }
  }, []);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: "Vui lòng chọn file hình ảnh hợp lệ."
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive", 
        title: "Lỗi tải lên",
        description: "Kích thước file phải nhỏ hơn 5MB."
      });
      return;
    }

    setIsImageUploading(true);

    try {
      const previousImageUrl = imageUrl; // Store previous URL for potential cleanup
      
      const formData = new FormData();
      formData.append('file', file);

      const uploadUrl = `/api/temp-description-images/upload?context=${context}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        onImageChange(result.url);
        
        // Only cleanup previous temporary image after successful upload (supports both legacy and context-based URLs)
        const isPrevTempImage = previousImageUrl && (
          previousImageUrl.includes('/api/temp-description-images/') || 
          previousImageUrl.match(/\/api\/(qbank|exam)-temp-description-images\//)
        );
        if (isPrevTempImage) {
          await cleanupPreviousFile(previousImageUrl, "/api/temp-description-images/cleanup");
        }
        
        toast({
          title: "Thành công",
          description: result.message || "Tải lên hình ảnh mô tả thành công!"
        });
      } else {
        throw new Error(result.message || "Tải lên thất bại");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi tải lên hình ảnh mô tả."
      });
    } finally {
      setIsImageUploading(false);
      // Reset input value to allow re-uploading same file
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }, [imageUrl, onImageChange, toast, cleanupPreviousFile]);

  const handleAudioUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: "Vui lòng chọn file audio hợp lệ."
      });
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên", 
        description: "Kích thước file audio phải nhỏ hơn 50MB."
      });
      return;
    }

    setIsAudioUploading(true);

    try {
      const previousAudioUrl = audioUrl; // Store previous URL for potential cleanup
      
      const formData = new FormData();
      formData.append('file', file);

      const uploadUrl = `/api/temp-description-audio/upload?context=${context}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        onAudioChange(result.url);
        
        // Only cleanup previous temporary audio after successful upload (supports both legacy and context-based URLs)
        const isPrevTempAudio = previousAudioUrl && (
          previousAudioUrl.includes('/api/temp-description-audio/') || 
          previousAudioUrl.match(/\/api\/(qbank|exam)-temp-description-audio\//)
        );
        if (isPrevTempAudio) {
          await cleanupPreviousFile(previousAudioUrl, "/api/temp-description-audio/cleanup");
        }
        
        toast({
          title: "Thành công",
          description: result.message || "Tải lên audio mô tả thành công!"
        });
      } else {
        throw new Error(result.message || "Tải lên thất bại");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi tải lên audio mô tả."
      });
    } finally {
      setIsAudioUploading(false);
      // Reset input value to allow re-uploading same file
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    }
  }, [audioUrl, onAudioChange, toast, cleanupPreviousFile]);

  const removeImage = useCallback(async () => {
    if (imageUrl) {
      await cleanupPreviousFile(imageUrl, "/api/temp-description-images/cleanup");
      onImageChange("");
    }
  }, [imageUrl, onImageChange, cleanupPreviousFile]);

  const removeAudio = useCallback(async () => {
    if (audioUrl) {
      await cleanupPreviousFile(audioUrl, "/api/temp-description-audio/cleanup");
      onAudioChange("");
      setIsAudioPlaying(false);
    }
  }, [audioUrl, onAudioChange, cleanupPreviousFile]);

  const toggleAudioPlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioRef.current.play();
      setIsAudioPlaying(true);
    }
  }, [isAudioPlaying, audioUrl]);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Hình ảnh và Audio cho phần mô tả
      </h4>
      
      {/* Image Upload Section */}
      <div className="space-y-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">
          Hình ảnh mô tả (Tùy chọn)
        </label>
        
        {imageUrl ? (
          <div className="space-y-2">
            <div className="relative w-full max-w-md border rounded-md overflow-hidden">
              <img 
                src={imageUrl} 
                alt="Description image"
                className="w-full h-48 object-cover"
                data-testid="preview-description-image"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={removeImage}
                disabled={disabled}
                data-testid="button-remove-description-image"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={disabled || isImageUploading}
              className="hidden"
              data-testid="input-description-image"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
              disabled={disabled || isImageUploading}
              className="w-full"
              data-testid="button-upload-description-image"
            >
              {isImageUploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải lên...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Tải lên hình ảnh mô tả
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Audio Upload Section */}
      <div className="space-y-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">
          Audio mô tả (Tùy chọn)
        </label>
        
        {audioUrl ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAudioPlayback}
                disabled={disabled}
                data-testid="button-play-description-audio"
              >
                {isAudioPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <div className="flex-1 flex items-center space-x-2">
                <Volume2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Audio mô tả đã tải lên
                </span>
              </div>
              
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={removeAudio}
                disabled={disabled}
                data-testid="button-remove-description-audio"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsAudioPlaying(false)}
              onError={() => setIsAudioPlaying(false)}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              disabled={disabled || isAudioUploading}
              className="hidden"
              data-testid="input-description-audio"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => audioInputRef.current?.click()}
              disabled={disabled || isAudioUploading}
              className="w-full"
              data-testid="button-upload-description-audio"
            >
              {isAudioUploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải lên...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Tải lên audio mô tả
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}