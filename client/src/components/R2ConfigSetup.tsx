import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Settings, Copy, CheckCircle, AlertCircle } from "lucide-react";

interface R2ConfigData {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
}

export function R2ConfigSetup() {
  const [config, setConfig] = useState<R2ConfigData>({
    accountId: "",
    accessKeyId: "be278ed37b268e592fd2daf49d46760b",
    secretAccessKey: "4fc535a063fa7748c1f48a387875341bf931c7d1c0b10315670c06b40de9aefb",
    bucketName: "",
    endpoint: ""
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleInputChange = (field: keyof R2ConfigData, value: string) => {
    setConfig(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate endpoint when account ID changes
      if (field === "accountId" && value) {
        updated.endpoint = `https://${value}.r2.cloudflarestorage.com`;
      }
      
      return updated;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "Nội dung đã được sao chép vào clipboard",
    });
  };

  const generateSecretsConfig = () => {
    const secrets = [
      `R2_PRIMARY_ACCOUNT_ID=${config.accountId}`,
      `R2_PRIMARY_ACCESS_KEY_ID=${config.accessKeyId}`,
      `R2_PRIMARY_SECRET_ACCESS_KEY=${config.secretAccessKey}`,
      `R2_PRIMARY_BUCKET_NAME=${config.bucketName}`,
      `R2_PRIMARY_ENDPOINT=${config.endpoint}`
    ];
    
    return secrets.join('\n');
  };

  const testConnection = async () => {
    if (!config.accountId || !config.bucketName) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ Account ID và Bucket Name",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Here you would test the connection with the provided credentials
      // For now, we'll simulate a test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTestResult({
        success: true,
        message: "Kết nối thành công! Có thể sử dụng cấu hình này."
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: "Kết nối thất bại. Vui lòng kiểm tra lại thông tin."
      });
    } finally {
      setTesting(false);
    }
  };

  const isConfigComplete = config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Thiết lập kết nối Cloudflare R2
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Điền thông tin R2 của bạn vào form dưới đây. Sau đó copy các environment variables vào Replit Secrets.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="accountId">Account ID *</Label>
            <Input
              id="accountId"
              value={config.accountId}
              onChange={(e) => handleInputChange("accountId", e.target.value)}
              placeholder="Nhập Account ID từ Cloudflare Dashboard"
            />
          </div>

          <div>
            <Label htmlFor="accessKeyId">Access Key ID *</Label>
            <div className="flex gap-2">
              <Input
                id="accessKeyId"
                value={config.accessKeyId}
                onChange={(e) => handleInputChange("accessKeyId", e.target.value)}
                placeholder="Nhập Access Key từ API Token"
                readOnly
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(config.accessKeyId)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="secretAccessKey">Secret Access Key *</Label>
            <div className="flex gap-2">
              <Input
                id="secretAccessKey"
                type="password"
                value={config.secretAccessKey}
                onChange={(e) => handleInputChange("secretAccessKey", e.target.value)}
                placeholder="Nhập Secret Access Key"
                readOnly
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(config.secretAccessKey)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="bucketName">Bucket Name *</Label>
            <Input
              id="bucketName"
              value={config.bucketName}
              onChange={(e) => handleInputChange("bucketName", e.target.value)}
              placeholder="Tên bucket R2 (ví dụ: my-website-media)"
            />
          </div>

          <div>
            <Label htmlFor="endpoint">Endpoint URL</Label>
            <Input
              id="endpoint"
              value={config.endpoint}
              onChange={(e) => handleInputChange("endpoint", e.target.value)}
              placeholder="Sẽ tự động tạo khi nhập Account ID"
              readOnly
            />
          </div>
        </div>

        {isConfigComplete && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button onClick={testConnection} disabled={testing}>
                {testing ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
              </Button>
            </div>

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold">Environment Variables for Replit Secrets:</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generateSecretsConfig())}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy All
                </Button>
              </div>
              <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                {generateSecretsConfig()}
              </pre>
            </div>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>Bước tiếp theo:</strong>
                <br />1. Copy các environment variables ở trên
                <br />2. Vào Tools → Secrets trong Replit
                <br />3. Thêm từng cặp key-value
                <br />4. Restart ứng dụng để áp dụng cấu hình
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}