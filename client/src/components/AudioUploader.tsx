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
}

export function AudioUploader({ 
  onAudioUpload, 
  currentAudioUrl, 
  currentFileName,
  onRemoveAudio, 
  disabled = false 
}: AudioUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [originalFileName, setOriginalFileName] = useState<string>("");
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
      setOriginalFileName(file.name);

      // Use direct upload via server
      const formData = new FormData();
      formData.append('audio', file);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
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
              description: "Upload file audio thành công",
            });
          } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            throw new Error('Invalid server response');
          }
        } else {
          console.error('Upload failed with status:', xhr.status);
          throw new Error(`Upload failed with status: ${xhr.status}`);
        }
      });

      xhr.addEventListener('error', (e) => {
        console.error('XMLHttpRequest error event:', e);
        console.error('Upload error - status:', xhr.status);
        console.error('Upload error - response:', xhr.responseText);
        throw new Error(`Upload failed - Network error`);
      });

      xhr.open('POST', '/api/audio/upload-direct');
      xhr.send(formData);

    } catch (error) {
      console.error('Audio upload error:', error);
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể upload file audio",
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
              <span className="text-sm text-gray-700">
                {currentFileName || originalFileName || "File audio đã upload"}
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