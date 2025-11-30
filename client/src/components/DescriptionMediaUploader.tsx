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

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB - use chunked upload for files larger than this

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
  
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [audioUploadedBytes, setAudioUploadedBytes] = useState(0);
  const [audioTotalBytes, setAudioTotalBytes] = useState(0);
  const [audioFileName, setAudioFileName] = useState("");
  const [uploadMode, setUploadMode] = useState<"direct" | "chunked">("direct");
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioXhrRef = useRef<XMLHttpRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chunkedUploadSessionRef = useRef<string | null>(null);
  
  const { toast } = useToast();

  const cleanupPreviousFile = useCallback(async (currentUrl: string, cleanupEndpoint: string) => {
    const isTempFile = currentUrl && (
      currentUrl.includes('/api/temp-') || 
      currentUrl.match(/\/api\/(qbank|exam)-temp-/)
    );
    
    if (isTempFile) {
      try {
        const filename = currentUrl.split('/').pop();
        if (filename) {
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

    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: "Vui lòng chọn file hình ảnh hợp lệ."
      });
      return;
    }

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
      const previousImageUrl = imageUrl;
      
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
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }, [imageUrl, onImageChange, toast, cleanupPreviousFile, context]);

  const uploadChunkedAudio = useCallback(async (file: File, previousAudioUrl: string) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    console.log(`Starting chunked upload: ${file.name}, ${formatFileSize(file.size)}, ${totalChunks} chunks`);

    try {
      const initResponse = await fetch('/api/chunked-upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          totalSize: file.size,
          totalChunks,
          context
        }),
        signal: abortController.signal
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        throw new Error(error.message || 'Failed to initialize upload');
      }

      const initResult = await initResponse.json();
      const { sessionId } = initResult;
      chunkedUploadSessionRef.current = sessionId;

      console.log(`Chunked upload initialized: ${sessionId}, ${totalChunks} chunks`);

      let uploadedBytes = 0;
      for (let i = 0; i < totalChunks; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('sessionId', sessionId);
        formData.append('chunkIndex', i.toString());

        const chunkResponse = await fetch('/api/chunked-upload/chunk', {
          method: 'POST',
          body: formData,
          signal: abortController.signal
        });

        if (!chunkResponse.ok) {
          const error = await chunkResponse.json();
          throw new Error(error.message || `Failed to upload chunk ${i + 1}`);
        }

        uploadedBytes += chunk.size;
        const progress = Math.round((uploadedBytes / file.size) * 100);
        setAudioUploadProgress(progress);
        setAudioUploadedBytes(uploadedBytes);

        console.log(`Chunk ${i + 1}/${totalChunks} uploaded (${progress}%)`);
      }

      const completeResponse = await fetch('/api/chunked-upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        signal: abortController.signal
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.message || 'Failed to complete upload');
      }

      const completeResult = await completeResponse.json();
      
      onAudioChange(completeResult.url);
      
      const isPrevTempAudio = previousAudioUrl && (
        previousAudioUrl.includes('/api/temp-description-audio/') || 
        previousAudioUrl.match(/\/api\/(qbank|exam)-temp-description-audio\//)
      );
      if (isPrevTempAudio) {
        await cleanupPreviousFile(previousAudioUrl, "/api/temp-description-audio/cleanup");
      }
      
      toast({
        title: "Thành công",
        description: `Tải lên audio thành công! (${formatFileSize(file.size)}, ${totalChunks} phần)`
      });

      console.log(`Chunked upload completed: ${completeResult.url}`);

    } catch (error) {
      if ((error as Error).name === 'AbortError' || (error as Error).message === 'Upload cancelled') {
        if (chunkedUploadSessionRef.current) {
          fetch('/api/chunked-upload/abort', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: chunkedUploadSessionRef.current })
          }).catch(() => {});
        }
        toast({
          title: "Đã hủy",
          description: "Upload đã bị hủy"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Lỗi upload",
          description: (error as Error).message || "Không thể tải lên audio"
        });
      }
      throw error;
    } finally {
      chunkedUploadSessionRef.current = null;
      abortControllerRef.current = null;
    }
  }, [context, onAudioChange, cleanupPreviousFile, toast]);

  const handleAudioUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: "Vui lòng chọn file audio hợp lệ."
      });
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File quá lớn", 
        description: `Kích thước file audio phải nhỏ hơn 50MB. File của bạn: ${formatFileSize(file.size)}`
      });
      return;
    }

    const previousAudioUrl = audioUrl;
    const useChunkedUpload = file.size >= LARGE_FILE_THRESHOLD;
    
    setIsAudioUploading(true);
    setAudioUploadProgress(0);
    setAudioUploadedBytes(0);
    setAudioTotalBytes(file.size);
    setAudioFileName(file.name);
    setUploadMode(useChunkedUpload ? "chunked" : "direct");

    if (useChunkedUpload) {
      console.log(`Large file detected (${formatFileSize(file.size)}), using chunked upload`);
      try {
        await uploadChunkedAudio(file, previousAudioUrl);
      } catch (error) {
        console.error("Chunked upload failed:", error);
      } finally {
        setIsAudioUploading(false);
        setAudioUploadProgress(0);
        setUploadMode("direct");
        if (audioInputRef.current) {
          audioInputRef.current.value = '';
        }
      }
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    audioXhrRef.current = xhr;
    xhr.timeout = 600000;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        setAudioUploadProgress(progress);
        setAudioUploadedBytes(e.loaded);
        setAudioTotalBytes(e.total);
      }
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText);
          if (result.success) {
            onAudioChange(result.url);
            
            const isPrevTempAudio = previousAudioUrl && (
              previousAudioUrl.includes('/api/temp-description-audio/') || 
              previousAudioUrl.match(/\/api\/(qbank|exam)-temp-description-audio\//)
            );
            if (isPrevTempAudio) {
              await cleanupPreviousFile(previousAudioUrl, "/api/temp-description-audio/cleanup");
            }
            
            toast({
              title: "Thành công",
              description: `Tải lên audio mô tả thành công! (${formatFileSize(file.size)})`
            });
          } else {
            throw new Error(result.message || "Tải lên thất bại");
          }
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Lỗi",
            description: error instanceof Error ? error.message : "Phản hồi từ server không hợp lệ"
          });
        }
      } else {
        let errorMsg = "Không thể tải lên audio";
        try {
          const errorResult = JSON.parse(xhr.responseText);
          if (errorResult.message) errorMsg = errorResult.message;
        } catch {}
        toast({
          variant: "destructive",
          title: "Lỗi upload",
          description: errorMsg
        });
      }
      setIsAudioUploading(false);
      setAudioUploadProgress(0);
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    });

    xhr.addEventListener('error', () => {
      toast({
        variant: "destructive",
        title: "Lỗi kết nối",
        description: "Không thể kết nối đến server. Vui lòng thử lại."
      });
      setIsAudioUploading(false);
      setAudioUploadProgress(0);
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    });

    xhr.addEventListener('timeout', () => {
      toast({
        variant: "destructive",
        title: "Hết thời gian",
        description: "Upload file quá lâu. Vui lòng thử lại."
      });
      setIsAudioUploading(false);
      setAudioUploadProgress(0);
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    });

    xhr.addEventListener('abort', () => {
      toast({
        title: "Đã hủy",
        description: "Upload đã bị hủy"
      });
      setIsAudioUploading(false);
      setAudioUploadProgress(0);
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    });

    const uploadUrl = `/api/temp-description-audio/upload?context=${context}`;
    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  }, [audioUrl, onAudioChange, toast, cleanupPreviousFile, context, uploadChunkedAudio]);

  const cancelAudioUpload = useCallback(() => {
    if (audioXhrRef.current) {
      audioXhrRef.current.abort();
      audioXhrRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (chunkedUploadSessionRef.current) {
      fetch('/api/chunked-upload/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: chunkedUploadSessionRef.current })
      }).catch(() => {});
      chunkedUploadSessionRef.current = null;
    }
  }, []);

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
          Audio mô tả (Tùy chọn - tối đa 50MB)
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
            
            {/* Audio Upload Progress */}
            {isAudioUploading && (
              <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-blue-800 dark:text-blue-300 truncate max-w-[200px]">
                    {audioFileName}
                    {uploadMode === "chunked" && (
                      <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded">
                        Chunked
                      </span>
                    )}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {formatFileSize(audioUploadedBytes)} / {formatFileSize(audioTotalBytes)}
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${audioUploadProgress}%` }}
                  >
                    {audioUploadProgress > 15 && (
                      <span className="text-xs text-white font-medium">{audioUploadProgress}%</span>
                    )}
                  </div>
                </div>
                {uploadMode === "chunked" && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Đang tải lên file lớn theo từng phần (5MB/phần)...
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelAudioUpload}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Hủy upload
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
