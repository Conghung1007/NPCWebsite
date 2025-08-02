import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image, CheckCircle, AlertCircle } from "lucide-react";

interface ArticleImageUploaderProps {
  storageProvider: string;
}

export function ArticleImageUploader({ storageProvider }: ArticleImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string; uploadCount?: number } | null>(null);
  const { toast } = useToast();

  const uploadArticleImages = async () => {
    setUploading(true);
    setProgress(0);
    setResult(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch("/api/articles/upload-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: storageProvider
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          uploadCount: data.uploadCount
        });
        
        toast({
          title: "Thành công",
          description: data.message,
        });
      } else {
        setResult({
          success: false,
          message: "Upload thất bại"
        });
        
        toast({
          title: "Lỗi",
          description: "Không thể upload hình ảnh",
          variant: "destructive",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Có lỗi xảy ra khi upload"
      });
      
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi upload hình ảnh",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Upload hình ảnh cho bài viết hiện có
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Tính năng này sẽ tự động thêm hình ảnh mẫu cho các bài viết chưa có hình ảnh. 
            Hình ảnh sẽ được upload lên <strong>{storageProvider === "replit" ? "Replit Object Storage" : `Cloudflare R2 (${storageProvider})`}</strong>.
          </AlertDescription>
        </Alert>

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Đang upload hình ảnh...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <AlertDescription>
              {result.message}
              {result.uploadCount !== undefined && (
                <span className="block mt-1 font-semibold">
                  Số lượng upload: {result.uploadCount} hình ảnh
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={uploadArticleImages} 
            disabled={uploading}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Đang upload..." : "Upload hình ảnh cho bài viết"}
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>Lưu ý:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Chỉ upload cho các bài viết chưa có hình ảnh</li>
            <li>Hình ảnh sẽ được chọn ngẫu nhiên phù hợp với danh mục bài viết</li>
            <li>Quá trình có thể mất vài phút tùy thuộc số lượng bài viết</li>
            <li>Sau khi upload xong, refresh trang để xem hình ảnh mới</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}