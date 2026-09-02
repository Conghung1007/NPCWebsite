import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { VIETQR_BANKS } from "@shared/paymentSettings";
import { CreditCard, ShieldCheck } from "lucide-react";

type PaymentSettingsRow = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferTemplate: string;
};

export function PaymentSettingsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PaymentSettingsRow>({
    bankCode: "VCB",
    bankName: "Vietcombank",
    accountNumber: "",
    accountName: "",
    transferTemplate: "LT {level} {username}",
  });

  const { data, isLoading } = useQuery<{
    settings: PaymentSettingsRow | null;
    payosConfigured: boolean;
  }>({
    queryKey: ["/api/admin/payment-settings", "luyenthi"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/api/admin/payment-settings?portal=luyenthi",
      );
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.settings) {
      setForm({
        bankCode: data.settings.bankCode || "VCB",
        bankName: data.settings.bankName || "",
        accountNumber: data.settings.accountNumber || "",
        accountName: data.settings.accountName || "",
        transferTemplate:
          data.settings.transferTemplate || "LT {level} {username}",
      });
    }
  }, [data?.settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/payment-settings", {
        portal: "luyenthi",
        ...form,
        bankName:
          form.bankName ||
          VIETQR_BANKS.find((b) => b.code === form.bankCode)?.name ||
          form.bankCode,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/payment-settings"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-display"] });
      toast({ title: "Đã lưu thông tin chuyển khoản" });
    },
    onError: (err: Error) => {
      toast({
        title: "Không lưu được",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const payosOk = data?.payosConfigured ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Thanh toán luyện thi
        </CardTitle>
        <CardDescription>
          Quản lý chỉ nhập STK để hiển thị QR chuyển khoản. Key PayOS do kỹ thuật
          cấu hình trên server — không lưu trên web.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">PayOS (tự xác nhận):</span>
          {payosOk ? (
            <Badge className="bg-emerald-600">Đã kết nối trên server</Badge>
          ) : (
            <Badge variant="secondary">Chưa cấu hình — dùng CK thủ công</Badge>
          )}
          <span className="text-xs text-muted-foreground w-full sm:w-auto">
            Liên kết STK thật trên{" "}
            <a
              href="https://my.payos.vn"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              my.payos.vn
            </a>
            ; dev thêm PAYOS_* vào môi trường.
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bankCode">Ngân hàng</Label>
              <Select
                value={form.bankCode}
                onValueChange={(code) => {
                  const bank = VIETQR_BANKS.find((b) => b.code === code);
                  setForm((f) => ({
                    ...f,
                    bankCode: code,
                    bankName: bank?.name ?? code,
                  }));
                }}
              >
                <SelectTrigger id="bankCode">
                  <SelectValue placeholder="Chọn ngân hàng" />
                </SelectTrigger>
                <SelectContent>
                  {VIETQR_BANKS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Số tài khoản</Label>
              <Input
                id="accountNumber"
                value={form.accountNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accountNumber: e.target.value }))
                }
                placeholder="0123456789"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="accountName">Tên chủ tài khoản (không dấu)</Label>
              <Input
                id="accountName"
                value={form.accountName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accountName: e.target.value }))
                }
                placeholder="NGUYEN VAN A"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="transferTemplate">Mẫu nội dung CK</Label>
              <Input
                id="transferTemplate"
                value={form.transferTemplate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, transferTemplate: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Biến: {"{level}"}, {"{username}"}, {"{package}"}, {"{amount}"}
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
        >
          {saveMutation.isPending ? "Đang lưu…" : "Lưu thông tin chuyển khoản"}
        </Button>
      </CardContent>
    </Card>
  );
}
