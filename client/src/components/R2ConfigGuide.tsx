import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Settings, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function R2ConfigGuide() {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "Environment variable đã được sao chép vào clipboard",
    });
  };

  const envVars = [
    {
      key: "R2_PRIMARY_ACCOUNT_ID",
      description: "Account ID của Cloudflare R2 (tìm trong Dashboard > R2)",
      example: "abcd1234567890ef"
    },
    {
      key: "R2_PRIMARY_ACCESS_KEY_ID", 
      description: "Access Key ID từ R2 API Token",
      example: "abc123..."
    },
    {
      key: "R2_PRIMARY_SECRET_ACCESS_KEY",
      description: "Secret Access Key từ R2 API Token", 
      example: "xyz789..."
    },
    {
      key: "R2_PRIMARY_BUCKET_NAME",
      description: "Tên bucket R2 đã tạo",
      example: "my-website-media"
    },
    {
      key: "R2_PRIMARY_ENDPOINT",
      description: "Endpoint URL của R2",
      example: "https://your-account-id.r2.cloudflarestorage.com"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Hướng dẫn cấu hình Cloudflare R2 External
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            Để kết nối với tài khoản Cloudflare R2 riêng, bạn cần thêm các environment variables sau vào Replit Secrets.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Các bước cấu hình:</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">1</Badge>
              <span>Tạo R2 API Token tại Cloudflare Dashboard</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open("https://dash.cloudflare.com/profile/api-tokens", "_blank")}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">2</Badge>
              <span>Tạo R2 bucket cho website</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open("https://dash.cloudflare.com/r2", "_blank")}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">3</Badge>
              <span>Thêm environment variables vào Replit Secrets</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Environment Variables cần thiết:</h4>
          
          {envVars.map((envVar) => (
            <div key={envVar.key} className="p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between mb-1">
                <code className="text-sm font-mono font-semibold text-blue-600">
                  {envVar.key}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(envVar.key)}
                  className="h-auto p-1"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-gray-600 mb-1">{envVar.description}</p>
              <p className="text-xs text-gray-400 font-mono">{envVar.example}</p>
            </div>
          ))}
        </div>

        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-sm">
            <strong>Lưu ý:</strong> Sau khi thêm environment variables, restart lại ứng dụng để các thay đổi có hiệu lực.
            Bạn có thể tạo multiple R2 configurations bằng cách thay "PRIMARY" thành "SECONDARY" trong tên các biến.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open("https://developers.cloudflare.com/r2/", "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Tài liệu Cloudflare R2
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open("https://replit.com/", "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Replit Secrets
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}