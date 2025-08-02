import { useState } from "react";
import { MediaUploader } from "./MediaUploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Image, Video, Upload } from "lucide-react";
import type { UploadResult } from "@uppy/core";

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string;
}

interface ArticleMediaManagerProps {
  onMediaChange: (imageUrl?: string, videoUrl?: string) => void;
  initialImage?: string;
  initialVideo?: string;
  storageProvider?: string;
}

export function ArticleMediaManager({ 
  onMediaChange, 
  initialImage, 
  initialVideo,
  storageProvider = "replit"
}: ArticleMediaManagerProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    const items: MediaItem[] = [];
    if (initialImage) {
      items.push({
        id: 'initial-image',
        url: initialImage,
        type: 'image',
        name: 'Image'
      });
    }
    if (initialVideo) {
      items.push({
        id: 'initial-video',
        url: initialVideo,
        type: 'video',
        name: 'Video'
      });
    }
    return items;
  });

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: storageProvider,
        folder: "article-media"
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }

    const { uploadURL } = await response.json();
    return {
      method: "PUT" as const,
      url: uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (!result?.successful) return;
    
    for (const file of result.successful) {
      try {
        // Finalize upload by setting ACL
        const response = await fetch("/api/media/finalize", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mediaURL: file.uploadURL,
          }),
        });

        if (response.ok) {
          const { objectPath } = await response.json();
          const mediaType = file.type?.startsWith('video/') ? 'video' : 'image';
          
          const newMediaItem: MediaItem = {
            id: file.id || Date.now().toString(),
            url: objectPath,
            type: mediaType,
            name: file.name || 'Uploaded file'
          };

          setMediaItems(prev => {
            // Remove existing item of same type
            const filtered = prev.filter(item => item.type !== mediaType);
            const updated = [...filtered, newMediaItem];
            
            // Update parent component
            const imageItem = updated.find(item => item.type === 'image');
            const videoItem = updated.find(item => item.type === 'video');
            onMediaChange(imageItem?.url, videoItem?.url);
            
            return updated;
          });
        }
      } catch (error) {
        console.error("Error finalizing upload:", error);
      }
    }
  };

  const removeMediaItem = (id: string) => {
    setMediaItems(prev => {
      const updated = prev.filter(item => item.id !== id);
      
      // Update parent component
      const imageItem = updated.find(item => item.type === 'image');
      const videoItem = updated.find(item => item.type === 'video');
      onMediaChange(imageItem?.url, videoItem?.url);
      
      return updated;
    });
  };

  const getMediaPreview = (item: MediaItem) => {
    if (item.type === 'image') {
      return (
        <img
          src={item.url.startsWith('/objects/') ? item.url : item.url}
          alt={item.name}
          className="w-full h-32 object-cover rounded"
        />
      );
    } else {
      return (
        <video
          src={item.url.startsWith('/objects/') ? item.url : item.url}
          className="w-full h-32 object-cover rounded"
          controls
        >
          Video not supported
        </video>
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Media quản lý</h3>
        <MediaUploader
          maxNumberOfFiles={2}
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Media
        </MediaUploader>
      </div>

      {mediaItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mediaItems.map((item) => (
            <Card key={item.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {item.type === 'image' ? (
                      <Image className="w-4 h-4" />
                    ) : (
                      <Video className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMediaItem(item.id)}
                    className="h-auto p-1"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {getMediaPreview(item)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mediaItems.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">
              Chưa có media nào. Click "Upload Media" để thêm hình ảnh hoặc video.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}