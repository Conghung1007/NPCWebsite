import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Check, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/queryClient";

interface ImageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onImageUpdate: (imageUrl: string) => void;
  imageType: string;
  altText: string;
  className?: string;
}

export function ImageManager({
  isOpen,
  onClose,
  onImageUpdate,
  imageType,
  altText,
  className = ""
}: ImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedExistingImage, setSelectedExistingImage] = useState<string>("");
  const [activeTab, setActiveTab] = useState("upload");
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query existing images
  const { data: existingImages, isLoading: loadingImages, error: imagesError } = useQuery({
    queryKey: ["/api/images/list"],
    enabled: isOpen,
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const response = await apiFetch(`/api/ui-images/${fileName}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      setImageToDelete(null);
      toast({
        title: "Thành công",
        description: "Đã xóa hình ảnh thành công"
      });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa hình ảnh",
        variant: "destructive"
      });
    }
  });

  // Extract image name from URL
  const getImageName = (url: string): string => {
    if (url.startsWith('/api/proxy-image/')) {
      // Extract from proxy URL: /api/proxy-image/primary/ui-images/filename
      const parts = url.split('/');
      return parts[parts.length - 1];
    }
    // Fallback for direct URLs
    return url.split('/').pop() || url;
  };

  const confirmDeleteImage = () => {
    if (imageToDelete) {
      deleteImageMutation.mutate(imageToDelete);
    }
  };

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
      // Upload directly via server
      console.log('Uploading file via server...', file.name, file.type, file.size);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', imageType);
      formData.append('altText', altText);
      
      const serverUploadResponse = await apiFetch('/api/ui-images/server-upload', {
        method: 'POST',
        body: formData
      });
      
      if (!serverUploadResponse.ok) {
        const errorText = await serverUploadResponse.text();
        throw new Error(`Server upload failed: ${errorText}`);
      }
      
      const serverUploadData = await serverUploadResponse.json();
      const finalUploadUrl = serverUploadData.imageUrl;

      // Update image directly and switch to existing tab
      onImageUpdate(finalUploadUrl);
      
      // Refresh the images list
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      
      // Switch to existing tab
      setActiveTab("existing");
      
      toast({
        title: "Thành công",
        description: "Hình ảnh đã được upload và cập nhật thành công!"
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

  const handleClose = () => {
    onClose();
    setSelectedExistingImage("");
    setImageToDelete(null);
    setUploading(false);
    setActiveTab("upload");
  };

  const handleConfirm = async () => {
    if (activeTab === "existing" && selectedExistingImage) {
      try {
        setUploading(true);
        
        // Update the UI image in database
        const updateResponse = await apiFetch(`/api/ui-images`, {
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
        handleClose();
        
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
    }
  };

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Quản lý hình ảnh</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Upload mới</TabsTrigger>
                <TabsTrigger value="existing">Chọn có sẵn</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="flex-1 space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="imageUpload"
                    disabled={uploading}
                  />
                  <label htmlFor="imageUpload" className={`cursor-pointer block ${uploading ? 'opacity-50' : ''}`}>
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      {uploading ? "Đang upload..." : "Chọn hình ảnh để upload"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Hỗ trợ: JPG, PNG, GIF, WebP (tối đa 10MB)
                    </p>
                  </label>
                </div>
                
                <div className="text-center py-8">
                  <p className="text-center text-muted-foreground">
                    Chọn file để upload hình ảnh mới. Sau khi upload thành công, bạn có thể chọn hình ảnh từ tab "Chọn có sẵn".
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="existing" className="flex-1 space-y-4 overflow-hidden">
                <div className="space-y-2 h-full flex flex-col">
                  <div className="flex-1 overflow-y-auto max-h-[500px]">
                    {loadingImages ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2">Đang tải danh sách hình ảnh...</p>
                      </div>
                    ) : existingImages && Array.isArray(existingImages) && existingImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3 pr-2">
                        {existingImages.map((image, index) => (
                          <Card key={index} className={`image-card cursor-pointer transition-all ${
                            selectedExistingImage === image.url ? 'ring-2 ring-primary' : ''
                          }`}>
                            <CardContent className="p-2">
                              <div className="relative">
                                <img
                                  src={image.url}
                                  alt={image.name}
                                  className="w-full h-20 object-cover rounded"
                                  onClick={() => setSelectedExistingImage(image.url)}
                                  onError={(e) => {
                                    console.error('Image load error for:', image.url);
                                    const target = e.target as HTMLImageElement;
                                    const cardElement = target.closest('.image-card');
                                    if (cardElement) {
                                      (cardElement as HTMLElement).style.display = 'none';
                                    }
                                  }}
                                />
                                {selectedExistingImage === image.url && (
                                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                                    <Check className="h-3 w-3" />
                                  </div>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="absolute top-1 left-1 h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setImageToDelete(getImageName(image.url));
                                      }}
                                      disabled={deleteImageMutation.isPending}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Xác nhận xóa hình ảnh</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Bạn có chắc chắn muốn xóa hình ảnh "{image.name}"? 
                                        Hành động này không thể hoàn tác và hình ảnh sẽ bị xóa vĩnh viễn từ hệ thống lưu trữ.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel onClick={() => setImageToDelete(null)}>
                                        Hủy
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={confirmDeleteImage}
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={deleteImageMutation.isPending}
                                      >
                                        {deleteImageMutation.isPending ? "Đang xóa..." : "Xóa"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                              <p className="text-xs text-center mt-1 truncate">{image.name}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Chưa có hình ảnh nào</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 pt-4 border-t mt-auto">
                    <Button
                      onClick={handleConfirm}
                      disabled={uploading || !selectedExistingImage}
                      className="flex-1"
                    >
                      {uploading ? "Đang cập nhật..." : "Cập nhật"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={uploading}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}