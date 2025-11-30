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

    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file âm thanh hợp lệ",
        variant: "destructive",
      });
      return;
    }

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

      const isTempFile = currentAudioUrl && (
        currentAudioUrl.includes('/api/temp-audio/') || 
        currentAudioUrl.match(/\/api\/(qbank|exam)-temp-audio\//)
      );
      
      if (isTempFile) {
        try {
          const oldFilename = currentAudioUrl.split('/').pop();
          if (oldFilename) {
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

      // Use chunked upload to bypass proxy body size limits (413 error)
      console.log('Starting chunked upload:', file.name, file.type, file.size);
      
      const CHUNK_SIZE = 512 * 1024; // 512KB per chunk - small enough to pass through any proxy
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploadId: string | null = null;
      let aborted = false;

      // Create abort controller for cancellation
      const abortController = new AbortController();
      xhrRef.current = { abort: () => { aborted = true; abortController.abort(); } } as any;

      try {
        // Step 1: Initialize chunked upload
        const initResponse = await fetch('/api/audio/chunked-upload/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalChunks,
            contentType: file.type,
            target: 'questionAudio',
            context,
            totalSize: file.size
          }),
          signal: abortController.signal
        });

        if (!initResponse.ok) {
          const error = await initResponse.json();
          throw new Error(error.message || 'Failed to initialize upload');
        }

        const initData = await initResponse.json();
        uploadId = initData.uploadId;
        console.log(`Chunked upload initialized: ${uploadId}, ${totalChunks} chunks`);

        // Step 2: Upload chunks sequentially
        for (let i = 0; i < totalChunks; i++) {
          if (aborted) {
            throw new Error('Upload cancelled');
          }

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const chunkResponse = await fetch(
            `/api/audio/chunked-upload/chunk?uploadId=${uploadId}&chunkIndex=${i}`,
            {
              method: 'POST',
              body: chunk,
              signal: abortController.signal
            }
          );

          if (!chunkResponse.ok) {
            const error = await chunkResponse.json();
            throw new Error(error.message || `Failed to upload chunk ${i}`);
          }

          // Update progress
          const progress = Math.round(((i + 1) / totalChunks) * 100);
          setUploadProgress(progress);
          setUploadedBytes(end);
          setTotalBytes(file.size);
        }

        // Step 3: Complete upload
        const completeResponse = await fetch('/api/audio/chunked-upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId }),
          signal: abortController.signal
        });

        if (!completeResponse.ok) {
          const error = await completeResponse.json();
          throw new Error(error.message || 'Failed to complete upload');
        }

        const result = await completeResponse.json();
        const audioUrl = result.audioUrl;
        console.log('Chunked upload completed:', audioUrl);

        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.load();
        }

        onAudioUpload(audioUrl);
        toast({
          title: "Thành công",
          description: `Upload file audio thành công (${formatFileSize(file.size)})`,
        });
      } catch (uploadError: any) {
        console.error('Chunked upload error:', uploadError);

        // Abort the upload on server if we have an uploadId
        if (uploadId && !aborted) {
          try {
            await fetch('/api/audio/chunked-upload/abort', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uploadId })
            });
          } catch {}
        }

        if (uploadError.name === 'AbortError' || aborted) {
          toast({
            title: "Đã hủy",
            description: "Upload file đã bị hủy",
          });
        } else {
          toast({
            title: "Lỗi",
            description: uploadError.message || "Không thể upload file audio",
            variant: "destructive",
          });
        }
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadedBytes(0);
        setTotalBytes(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

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
    const isTempFile = currentAudioUrl && (
      currentAudioUrl.includes('/api/temp-audio/') || 
      currentAudioUrl.match(/\/api\/(qbank|exam)-temp-audio\//)
    );
    
    if (isTempFile) {
      try {
        const filename = currentAudioUrl.split('/').pop();
        if (filename) {
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
