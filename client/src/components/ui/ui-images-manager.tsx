import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageManager } from "@/components/ui/image-manager";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Eye } from "lucide-react";

interface UiImage {
  id: string;
  imageUrl: string;
  imageType: string;
  altText: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const IMAGE_TYPE_DESCRIPTIONS = {
  "hero-banner": "Hình ảnh chính trên trang chủ (Hero Section)",
  "about-company": "Hình ảnh giới thiệu công ty",
  "why-choose-us": "Hình ảnh phần 'Tại sao chọn chúng tôi'",
  "visa-service": "Hình ảnh dịch vụ làm visa",
  "study-abroad": "Hình ảnh dịch vụ tư vấn du học",
  "japanese-training": "Hình ảnh khóa học tiếng Nhật",
  "flight-tickets": "Hình ảnh dịch vụ bán vé máy bay",
  "contact-banner": "Hình ảnh banner trang liên hệ"
};

export function UiImagesManager() {
  const [uiImages, setUiImages] = useState<UiImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingImage, setEditingImage] = useState<UiImage | null>(null);
  const [editForm, setEditForm] = useState({
    altText: "",
    description: ""
  });
  const { toast } = useToast();

  const loadUiImages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ui-images');
      if (response.ok) {
        const images = await response.json();
        setUiImages(images);
      }
    } catch (error) {
      console.error('Failed to load UI images:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách hình ảnh",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUiImages();
  }, []);

  const handleImageUpdate = (imageType: string) => {
    return (newImageUrl: string) => {
      setUiImages(prev => 
        prev.map(img => 
          img.imageType === imageType 
            ? { ...img, imageUrl: newImageUrl, updatedAt: new Date().toISOString() }
            : img
        )
      );
      toast({
        title: "Thành công",
        description: "Hình ảnh đã được cập nhật"
      });
    };
  };

  const handleEdit = (image: UiImage) => {
    setEditingImage(image);
    setEditForm({
      altText: image.altText || "",
      description: image.description || ""
    });
  };

  const handleSaveEdit = async () => {
    if (!editingImage) return;

    try {
      const response = await fetch(`/api/ui-images/${editingImage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          altText: editForm.altText,
          description: editForm.description
        })
      });

      if (response.ok) {
        setUiImages(prev => 
          prev.map(img => 
            img.id === editingImage.id
              ? { ...img, altText: editForm.altText, description: editForm.description }
              : img
          )
        );
        setEditingImage(null);
        toast({
          title: "Thành công",
          description: "Thông tin hình ảnh đã được cập nhật"
        });
      }
    } catch (error) {
      console.error('Failed to update image info:', error);
      toast({
        title: "Lỗi", 
        description: "Không thể cập nhật thông tin hình ảnh",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="p-6">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Quản lý hình ảnh giao diện</h2>
        <p className="text-muted-foreground">
          Quản lý các hình ảnh hiển thị trên website
        </p>
      </div>

      <div className="grid gap-6">
        {uiImages.map((image) => (
          <Card key={image.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {IMAGE_TYPE_DESCRIPTIONS[image.imageType as keyof typeof IMAGE_TYPE_DESCRIPTIONS] || image.imageType}
                    <Badge variant="outline">{image.imageType}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {image.description || "Chưa có mô tả"}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(image)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(image.imageUrl, '_blank')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Hình ảnh hiện tại</Label>
                    <div className="mt-2">
                      <img
                        src={image.imageUrl}
                        alt={image.altText || image.imageType}
                        className="w-full h-32 object-cover rounded-lg border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-image.jpg';
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">URL</Label>
                    <div className="mt-1 p-2 bg-muted rounded text-sm font-mono break-all">
                      {image.imageUrl}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {editingImage?.id === image.id ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor={`alt-${image.id}`}>Alt Text</Label>
                        <Input
                          id={`alt-${image.id}`}
                          value={editForm.altText}
                          onChange={(e) => setEditForm(prev => ({ ...prev, altText: e.target.value }))}
                          placeholder="Mô tả ngắn cho hình ảnh"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`desc-${image.id}`}>Mô tả</Label>
                        <Textarea
                          id={`desc-${image.id}`}
                          value={editForm.description}
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Mô tả chi tiết về hình ảnh"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveEdit} size="sm">
                          Lưu
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingImage(null)}
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Alt Text</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {image.altText || "Chưa có alt text"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Cập nhật hình ảnh</Label>
                        <div className="mt-2">
                          <ImageManager
                            imageType={image.imageType}
                            currentImageUrl={image.imageUrl}
                            onImageUpdate={handleImageUpdate(image.imageType)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                Tạo: {new Date(image.createdAt).toLocaleString('vi-VN')} • 
                Cập nhật: {new Date(image.updatedAt).toLocaleString('vi-VN')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}