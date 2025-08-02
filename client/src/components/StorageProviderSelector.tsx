import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Cloud, CheckCircle, XCircle, RefreshCw, Settings } from "lucide-react";

interface StorageProvider {
  id: string;
  name: string;
  status: "available" | "configured" | "missing";
  connected: boolean;
}

interface StorageProviderSelectorProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
}

export function StorageProviderSelector({ 
  selectedProvider, 
  onProviderChange 
}: StorageProviderSelectorProps) {
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/storage/providers");
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách nhà cung cấp lưu trữ",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnections = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/storage/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        // Update provider connection status
        setProviders(prev => 
          prev.map(provider => ({
            ...provider,
            connected: data.connections[provider.id] || false
          }))
        );
        
        toast({
          title: "Thành công",
          description: "Đã kiểm tra kết nối tất cả nhà cung cấp",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể kiểm tra kết nối",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const getStatusBadge = (provider: StorageProvider) => {
    if (provider.status === "missing") {
      return <Badge variant="destructive">Chưa cấu hình</Badge>;
    }
    
    if (provider.connected) {
      return <Badge variant="default" className="bg-green-500">Đã kết nối</Badge>;
    }
    
    return <Badge variant="secondary">Chưa kết nối</Badge>;
  };

  const getStatusIcon = (provider: StorageProvider) => {
    if (provider.status === "missing") {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    
    if (provider.connected) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    return <XCircle className="w-4 h-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="ml-2">Đang tải...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Chọn nhà cung cấp lưu trữ
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={testConnections}
            disabled={testing}
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Kiểm tra kết nối
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Chọn nhà cung cấp để upload media:
          </label>
          <Select value={selectedProvider} onValueChange={onProviderChange}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn nhà cung cấp lưu trữ" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem 
                  key={provider.id} 
                  value={provider.id}
                  disabled={provider.status === "missing"}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(provider)}
                    <span>{provider.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Trạng thái nhà cung cấp:</h4>
          {providers.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(provider)}
                <span className="font-medium">{provider.name}</span>
              </div>
              {getStatusBadge(provider)}
            </div>
          ))}
        </div>

        {providers.some(p => p.status === "missing") && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800 font-medium">
                Cấu hình R2 External
              </span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Để sử dụng Cloudflare R2 external, vui lòng thiết lập Secrets trong Replit.
            </p>
            <ul className="text-xs text-yellow-600 mt-2 space-y-1">
              <li>• R2_PRIMARY_ACCOUNT_ID</li>
              <li>• R2_PRIMARY_ACCESS_KEY_ID</li>
              <li>• R2_PRIMARY_SECRET_ACCESS_KEY</li>
              <li>• R2_PRIMARY_BUCKET_NAME</li>
              <li>• R2_PRIMARY_ENDPOINT</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}