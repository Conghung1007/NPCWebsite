import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Eye, X, ImageIcon, Trash2, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


interface ImageManagerProps {
  currentImageUrl?: string;
  onImageUpdate: (newImageUrl: string) => void;
  imageType: string;
  altText?: string;
  className?: string;
}

interface ExistingImage {
  name: string;
  url: string;
  lastModified: string;
  size: number;
}

export function ImageManager({
  currentImageUrl,
  onImageUpdate,
  imageType,
  altText = "Uploaded image",
  className = ""
}: ImageManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedExistingImage, setSelectedExistingImage] = useState<string>("");
  const [activeTab, setActiveTab] = useState("upload");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing images from R2
  const { data: existingImages, isLoading: loadingImages, error: imagesError } = useQuery<ExistingImage[]>({
    queryKey: ["/api/images/list"],
    retry: false,
  });

  // Debug logging
  React.useEffect(() => {
    console.log('ImageManager - existingImages:', existingImages);
    console.log('ImageManager - loadingImages:', loadingImages);
    console.log('ImageManager - imagesError:', imagesError);
  }, [existingImages, loadingImages, imagesError]);

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const response = await fetch(`/api/ui-images/${fileName}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      toast({
        title: "Thành công",
        description: "Đã xóa hình ảnh thành công",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa hình ảnh",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Lỗi",
        description: "Kích thước file không được vượt quá 10MB",
        variant: "destructive"
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Lỗi", 
        description: "Chỉ chấp nhận file hình ảnh",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      // Upload directly via server (like article uploads)
      console.log('Uploading file via server...', file.name, file.type, file.size);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', imageType);
      formData.append('altText', altText);
      
      const serverUploadResponse = await fetch('/api/ui-images/server-upload', {
        method: 'POST',
        body: formData
      });
      
      if (!serverUploadResponse.ok) {
        const errorText = await serverUploadResponse.text();
        throw new Error(`Server upload failed: ${errorText}`);
      }
      
      const serverUploadData = await serverUploadResponse.json();
      const finalUploadUrl = serverUploadData.imageUrl;

      // Set as preview URL for user to confirm
      setPreviewUrl(finalUploadUrl);
      
      // Refresh the images list
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      
      toast({
        title: "Thành công",
        description: "Hình ảnh đã được upload. Vui lòng bấm 'Cập nhật' để xác nhận."
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Lỗi",
        description: "Không thể upload hình ảnh",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpdate = async () => {
    if (!previewUrl.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập URL hình ảnh",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);
      
      const updateResponse = await fetch(`/api/ui-images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: previewUrl,
          imageType: imageType,
          altText: altText
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update image');
      }

      const updateData = await updateResponse.json();
      onImageUpdate(updateData.imageUrl);
      setIsOpen(false);
      setPreviewUrl("");
      
      // Refresh the images list  
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      
      toast({
        title: "Thành công", 
        description: "Hình ảnh đã được cập nhật"
      });

    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật hình ảnh",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Helper functions
  const handleClose = () => {
    setIsOpen(false);
    setPreviewUrl("");
    setSelectedExistingImage("");
    setUploading(false);
    setActiveTab("upload");
  };

  const handleDeleteImage = async (fileName: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa hình ảnh này không?")) {
      deleteImageMutation.mutate(fileName);
    }
  };

  const getImageName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  const handleConfirm = async () => {
    if (activeTab === "existing" && selectedExistingImage) {
      try {
        setUploading(true);
        
        // Update the UI image in database
        const updateResponse = await fetch(`/api/ui-images`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: selectedExistingImage,
            imageType: imageType,
            altText: altText
          })
        });

        if (!updateResponse.ok) {
          throw new Error('Failed to update image');
        }

        const updateData = await updateResponse.json();
        onImageUpdate(updateData.imageUrl);
        setIsOpen(false);
        setSelectedExistingImage("");
        
        toast({
          title: "Thành công",
          description: "Đã chọn hình ảnh thành công",
        });
      } catch (error) {
        console.error('Update error:', error);
        toast({
          title: "Lỗi",
          description: "Không thể cập nhật hình ảnh",
          variant: "destructive"
        });
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`gap-2 ${className}`}
      >
        <Upload className="h-4 w-4" />
        Đổi hình ảnh
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quản lý hình ảnh</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Tải lên mới</TabsTrigger>
              <TabsTrigger value="existing">Chọn có sẵn</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              {currentImageUrl && (
                <div className="space-y-2">
                  <Label>Hình ảnh hiện tại:</Label>
                  <img 
                    src={currentImageUrl} 
                    alt={altText}
                    className="w-full h-32 object-cover rounded border"
                  />
                </div>
              )}

            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload file mới:</Label>
              <Input
                id="file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </div>

            <div className="text-center text-muted-foreground">hoặc</div>

            <div className="space-y-2">
              <Label htmlFor="url-input">Nhập URL hình ảnh:</Label>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://..."
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  disabled={uploading}
                />
                {previewUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPreviewUrl("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {previewUrl && (
              <div className="space-y-2">
                <Label>Xem trước:</Label>
                <img 
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded border"
                  onError={() => {
                    toast({
                      title: "Lỗi",
                      description: "URL hình ảnh không hợp lệ",
                      variant: "destructive"
                    });
                  }}
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={previewUrl ? handleUrlUpdate : () => {}}
                disabled={uploading || (!previewUrl)}
                className="flex-1"
              >
                {uploading ? "Đang cập nhật..." : "Cập nhật"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  setPreviewUrl("");
                }}
                disabled={uploading}
              >
                Hủy
              </Button>
            </div>
            </TabsContent>

            <TabsContent value="existing" className="space-y-4">
              <div className="space-y-2">
                <Label>Hình ảnh có sẵn trên hệ thống:</Label>
                {loadingImages ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Đang tải danh sách hình ảnh...</p>
                  </div>
                ) : existingImages && existingImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {existingImages.map((image, index) => (
                      <Card key={index} className={`cursor-pointer transition-all ${
                        selectedExistingImage === image.url ? 'ring-2 ring-primary' : ''
                      }`}>
                        <CardContent className="p-2">
                          <div className="relative">
                            <img
                              src={image.url}
                              alt={image.name}
                              className="w-full h-24 object-cover rounded"
                              onClick={() => setSelectedExistingImage(image.url)}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNmMtMi4yMSAwLTQtMS43OS00LTRzMS43OS00IDQtNCA0IDEuNzkgNCA0LTEuNzkgNC00IDR6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6IiBmaWxsPSIjOWNhM2FmIi8+Cjwvc3ZnPg==';
                              }}
                            />
                            {selectedExistingImage === image.url && (
                              <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 left-1 h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(getImageName(image.url));
                              }}
                              disabled={deleteImageMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate" title={image.name}>
                            {image.name}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Chưa có hình ảnh nào</p>
                  </div>
                )}
              </div>

              {selectedExistingImage && (
                <div className="space-y-2">
                  <Label>Hình ảnh đã chọn:</Label>
                  <img 
                    src={selectedExistingImage}
                    alt="Selected image"
                    className="w-full h-32 object-cover rounded border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNmMtMi4yMSAwLTQtMS43OS00LTRzMS43OS00IDQtNCA0IDEuNzkgNCA0LTEuNzkgNC00IDR6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6IiBmaWxsPSIjOWNhM2FmIi8+Cjwvc3ZnPg==';
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedExistingImage || uploading}
                  className="flex-1"
                >
                  {uploading ? "Đang cập nhật..." : "Chọn hình ảnh này"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                >
                  Hủy
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}