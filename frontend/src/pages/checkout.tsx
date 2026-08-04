import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart, formatVnd } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { cart, isLoading } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    note: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || user.fullName || "",
      phone: prev.phone || user.phone || "",
      email: prev.email || user.email || "",
    }));
  }, [user]);

  const items = cart?.items ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "Giỏ hàng trống", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/checkout", form);
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      // PayOS not configured — go to success with pending order
      toast({
        title: "Đơn đã tạo",
        description: data.message || "Chờ cấu hình PayOS để thanh toán online.",
      });
      setLocation(`/checkout/success?order=${encodeURIComponent(data.order.code)}`);
    } catch (err: any) {
      toast({
        title: "Không thanh toán được",
        description: err?.message || "Thử lại sau",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-semibold mb-4">Giỏ hàng trống</h1>
        <Link href="/classes">
          <Button>Chọn lớp học</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12 grid gap-10 lg:grid-cols-5">
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-4">
          <h1 className="font-serif text-3xl font-bold mb-2">Thanh toán</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Không cần tài khoản — nhập thông tin liên hệ để nhận xác nhận đăng ký.
          </p>

          <div>
            <Label htmlFor="fullName">Họ và tên</Label>
            <Input
              id="fullName"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              required
              pattern="[0-9]{10,11}"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Đang xử lý..." : "Thanh toán với PayOS"}
          </Button>
        </form>

        <aside className="lg:col-span-2 border border-emerald-100 bg-white p-5 h-fit">
          <h2 className="font-semibold mb-4">Đơn hàng</h2>
          <ul className="space-y-3 mb-4">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 text-sm">
                <span className="line-clamp-2">{item.classSession.title}</span>
                <span className="shrink-0 font-medium">
                  {formatVnd(item.classSession.priceVnd)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-3 font-bold">
            <span>Tổng</span>
            <span className="text-primary">{formatVnd(cart?.totalVnd || 0)}</span>
          </div>
          <Link href="/cart" className="text-sm text-primary mt-4 inline-block">
            Sửa giỏ hàng
          </Link>
        </aside>
      </div>
    </div>
  );
}
