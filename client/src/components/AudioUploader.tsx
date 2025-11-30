import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Play, Pause, Trash2, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AudioUploaderProps {
  onAudioUpload: (audioUrl: string) => void;
  currentAudioUrl?: string;
  currentFileName?: string;
  onRemoveAudio?: () => void;
  disabled?: boolean;
  context?: "qbank" | "exam";
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function AudioUploader({ 
  onAudioUpload, 
  currentAudioUrl, 
  currentFileName,
  onRemoveAudio, 
  disabled = false,
  context = "qbank"
}: AudioUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [originalFileName, setOriginalFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file âm thanh hợp lệ",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Lỗi", 
        description: `File audio không được vượt quá 50MB. File của bạn: ${formatFileSize(file.size)}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadedBytes(0);
      setTotalBytes(file.size);
      setOriginalFileName(file.name);

      // Cleanup previous temporary file if exists (supports both legacy and context-based URLs)
      const isTempFile = currentAudioUrl && (
        currentAudioUrl.includes('/api/temp-audio/') || 
        currentAudioUrl.match(/\/api\/(qbank|exam)-temp-audio\//)
      );
      
      if (isTempFile) {
        try {
          const oldFilename = currentAudioUrl.split('/').pop();
          if (oldFilename) {
            // Extract context from URL if present
            const contextMatch = currentAudioUrl.match(/\/api\/(qbank|exam)-temp-/);
            const fileContext = contextMatch ? contextMatch[1] : undefined;
            const cleanupUrl = fileContext ? `/api/temp-audio/cleanup?context=${fileContext}` : '/api/temp-audio/cleanup';
            
            fetch(cleanupUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filenames: [oldFilename] })
            }).catch(e => console.warn("Failed to cleanup old temp file:", e));
          }
        } catch (error) {
          console.warn("Failed to cleanup old temporary audio file:", error);
        }
      }

      // Use direct upload via server
      const formData = new FormData();
      formData.append('audio', file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      
      // Set timeout to 10 minutes for large files
      xhr.timeout = 600000;
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
          setUploadedBytes(e.loaded);
          setTotalBytes(e.total);
        }
      });

      xhr.addEventListener('load', () => {
        console.log('Upload completed with status:', xhr.status);
        console.log('Upload response text:', xhr.responseText);
        
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            const audioUrl = response.audioUrl;
            const fileName = response.originalFileName;
            
            // Update current audio URL and load the audio
            if (audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.load(); // Force reload of audio element
            }
            
            // Update original file name for display
            if (fileName) {
              setOriginalFileName(fileName);
            }
            
            onAudioUpload(audioUrl);
            toast({
              title: "Thành công", 
              description: `Upload file audio thành công (${formatFileSize(file.size)})`,
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
          let errorMessage = `Upload thất bại (mã lỗi: ${xhr.status})`;
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            if (errorResponse.message) {
              errorMessage = errorResponse.message;
            }
          } catch {
            // Use default error message
          }
          console.error('Upload failed with status:', xhr.status);
          toast({
            title: "Lỗi",
            description: errorMessage,
            variant: "destructive",
          });
        }
        setIsUploading(false);
        setUploadProgress(0);
        setUploadedBytes(0);
        setTotalBytes(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });

      xhr.addEventListener('error', (e) => {
        console.error('XMLHttpRequest error event:', e);
        console.error('Upload error - status:', xhr.status);
        console.error('Upload error - response:', xhr.responseText);
        toast({
          title: "Lỗi kết nối",
          description: "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.",
          variant: "destructive",
        });
        setIsUploading(false);
        setUploadProgress(0);
        setUploadedBytes(0);
        setTotalBytes(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });

      xhr.addEventListener('timeout', () => {
        console.error('Upload timeout');
        toast({
          title: "Hết thời gian",
          description: "Upload file quá lâu. Vui lòng thử lại với file nhỏ hơn hoặc kiểm tra kết nối mạng.",
          variant: "destructive",
        });
        setIsUploading(false);
        setUploadProgress(0);
        setUploadedBytes(0);
        setTotalBytes(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });

      xhr.addEventListener('abort', () => {
        console.log('Upload aborted');
        toast({
          title: "Đã hủy",
          description: "Upload file đã bị hủy",
        });
        setIsUploading(false);
        setUploadProgress(0);
        setUploadedBytes(0);
        setTotalBytes(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });

      const endpointWithContext = `/api/audio/upload-direct?context=${context}`;
      xhr.open('POST', endpointWithContext);
      xhr.send(formData);

    } catch (error) {
      console.error('Audio upload error:', error);
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể upload file audio",
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
      setUploadedBytes(0);
      setTotalBytes(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !currentAudioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Ensure the audio src is set before playing
      if (!audioRef.current.src || audioRef.current.src !== currentAudioUrl) {
        audioRef.current.src = currentAudioUrl;
        audioRef.current.load();
      }
      audioRef.current.play().catch(error => {
        console.error('Audio play error:', error);
        toast({
          title: "Lỗi phát audio",
          description: "Không thể phát file audio này",
          variant: "destructive",
        });
      });
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleRemoveAudio = async () => {
    // If it's a temporary file, clean it up from R2 storage (supports both legacy and context-based URLs)
    const isTempFile = currentAudioUrl && (
      currentAudioUrl.includes('/api/temp-audio/') || 
      currentAudioUrl.match(/\/api\/(qbank|exam)-temp-audio\//)
    );
    
    if (isTempFile) {
      try {
        const filename = currentAudioUrl.split('/').pop();
        if (filename) {
          // Extract context from URL if present
          const contextMatch = currentAudioUrl.match(/\/api\/(qbank|exam)-temp-/);
          const fileContext = contextMatch ? contextMatch[1] : undefined;
          const cleanupUrl = fileContext ? `/api/temp-audio/cleanup?context=${fileContext}` : '/api/temp-audio/cleanup';
          
          await fetch(cleanupUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filenames: [filename] })
          });
        }
      } catch (error) {
        console.warn("Failed to cleanup temporary audio file:", error);
      }
    }
    
    // Call the parent component's remove handler
    if (onRemoveAudio) {
      onRemoveAudio();
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {!currentAudioUrl ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading 
              ? `Đang upload... ${uploadProgress}%` 
              : "Upload Audio (tối đa 50MB)"}
          </Button>
          
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{originalFileName}</span>
                <span>{formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center"
                  style={{ width: `${uploadProgress}%` }}
                >
                  {uploadProgress > 10 && (
                    <span className="text-xs text-white font-medium">{uploadProgress}%</span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelUpload}
                className="w-full text-red-600 hover:text-red-700"
              >
                Hủy upload
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-700">
                {originalFileName || currentFileName || "File audio đã upload"}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePlayPause}
                disabled={disabled}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
              {onRemoveAudio && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAudio}
                  disabled={disabled}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          <audio
            ref={audioRef}
            src={currentAudioUrl}
            onEnded={handleAudioEnded}
            preload="metadata"
          />
        </div>
      )}
    </div>
  );
}
