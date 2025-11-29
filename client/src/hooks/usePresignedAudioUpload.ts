import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UploadProgress {
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  fileName: string;
}

interface UsePresignedAudioUploadOptions {
  target?: 'questionAudio' | 'descriptionAudio' | 'sectionAudio';
  context?: 'qbank' | 'exam';
  maxSizeMB?: number;
  onSuccess?: (audioUrl: string) => void;
  onError?: (error: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function usePresignedAudioUpload(options: UsePresignedAudioUploadOptions = {}) {
  const {
    target = 'questionAudio',
    context = 'qbank',
    maxSizeMB = 50,
    onSuccess,
    onError
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    fileName: ''
  });
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const { toast } = useToast();

  const upload = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('audio/')) {
      const errorMsg = 'Vui lòng chọn file âm thanh hợp lệ';
      toast({
        title: 'Lỗi',
        description: errorMsg,
        variant: 'destructive',
      });
      onError?.(errorMsg);
      return null;
    }

    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File audio không được vượt quá ${maxSizeMB}MB. File của bạn: ${formatFileSize(file.size)}`;
      toast({
        title: 'Lỗi',
        description: errorMsg,
        variant: 'destructive',
      });
      onError?.(errorMsg);
      return null;
    }

    setIsUploading(true);
    setUploadProgress({
      progress: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      fileName: file.name
    });

    try {
      console.log('Getting presigned URL for:', file.name, file.type, file.size);
      const presignedResponse = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          target,
          context
        })
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to get upload URL (${presignedResponse.status})`);
      }

      const { uploadUrl, audioUrl } = await presignedResponse.json();
      console.log('Got presigned URL, uploading directly to R2...');

      return new Promise<string | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.timeout = 600000; // 10 minutes

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress({
              progress,
              uploadedBytes: e.loaded,
              totalBytes: e.total,
              fileName: file.name
            });
          }
        });

        xhr.addEventListener('load', () => {
          console.log('Direct R2 upload completed with status:', xhr.status);

          if (xhr.status >= 200 && xhr.status < 300) {
            toast({
              title: 'Thành công',
              description: `Upload file audio thành công (${formatFileSize(file.size)})`,
            });
            onSuccess?.(audioUrl);
            setIsUploading(false);
            setUploadProgress({ progress: 0, uploadedBytes: 0, totalBytes: 0, fileName: '' });
            resolve(audioUrl);
          } else {
            const errorMsg = `Upload thất bại (mã lỗi: ${xhr.status})`;
            toast({
              title: 'Lỗi',
              description: errorMsg,
              variant: 'destructive',
            });
            onError?.(errorMsg);
            setIsUploading(false);
            setUploadProgress({ progress: 0, uploadedBytes: 0, totalBytes: 0, fileName: '' });
            resolve(null);
          }
        });

        xhr.addEventListener('error', () => {
          const errorMsg = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.';
          toast({
            title: 'Lỗi kết nối',
            description: errorMsg,
            variant: 'destructive',
          });
          onError?.(errorMsg);
          setIsUploading(false);
          setUploadProgress({ progress: 0, uploadedBytes: 0, totalBytes: 0, fileName: '' });
          resolve(null);
        });

        xhr.addEventListener('timeout', () => {
          const errorMsg = 'Upload file quá lâu. Vui lòng thử lại với file nhỏ hơn hoặc kiểm tra kết nối mạng.';
          toast({
            title: 'Hết thời gian',
            description: errorMsg,
            variant: 'destructive',
          });
          onError?.(errorMsg);
          setIsUploading(false);
          setUploadProgress({ progress: 0, uploadedBytes: 0, totalBytes: 0, fileName: '' });
          resolve(null);
        });

        xhr.addEventListener('abort', () => {
          toast({
            title: 'Đã hủy',
            description: 'Upload file đã bị hủy',
          });
          setIsUploading(false);
          setUploadProgress({ progress: 0, uploadedBytes: 0, totalBytes: 0, fileName: '' });
          resolve(null);
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

    } catch (error) {
      console.error('Audio upload error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Không thể upload file audio';
      toast({
        title: 'Lỗi',
        description: errorMsg,
        variant: 'destructive',
      });
      onError?.(errorMsg);
      setIsUploading(false);
      setUploadProgress({ progress: 0, uploadedBytes: 0, totalBytes: 0, fileName: '' });
      return null;
    }
  }, [target, context, maxSizeMB, onSuccess, onError, toast]);

  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  return {
    upload,
    cancel,
    isUploading,
    uploadProgress,
    formatFileSize
  };
}
