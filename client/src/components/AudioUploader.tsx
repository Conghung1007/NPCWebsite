import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Play, Pause, Trash2, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AudioUploaderProps {
  onAudioUpload: (audioUrl: string) => void;
  currentAudioUrl?: string;
  onRemoveAudio?: () => void;
  disabled?: boolean;
}

export function AudioUploader({ 
  onAudioUpload, 
  currentAudioUrl, 
  onRemoveAudio, 
  disabled = false 
}: AudioUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Lỗi", 
        description: "File audio không được vượt quá 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get presigned URL for audio upload
      const uploadResponse = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, audioUrl } = await uploadResponse.json();

      // Upload file to R2
      const uploadToR2 = new XMLHttpRequest();
      
      uploadToR2.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      uploadToR2.addEventListener('load', () => {
        if (uploadToR2.status === 200) {
          onAudioUpload(audioUrl);
          toast({
            title: "Thành công",
            description: "Upload file audio thành công",
          });
        } else {
          throw new Error('Upload failed');
        }
      });

      uploadToR2.addEventListener('error', () => {
        throw new Error('Upload failed');
      });

      uploadToR2.open('PUT', uploadUrl);
      uploadToR2.setRequestHeader('Content-Type', file.type);
      uploadToR2.send(file);

    } catch (error) {
      console.error('Audio upload error:', error);
      toast({
        title: "Lỗi",
        description: "Không thể upload file audio. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !currentAudioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
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
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? `Đang upload... ${uploadProgress}%` : "Upload Audio"}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-700">File audio đã upload</span>
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
                  onClick={onRemoveAudio}
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

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}