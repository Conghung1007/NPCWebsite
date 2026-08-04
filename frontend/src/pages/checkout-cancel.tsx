import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";
import { XCircle } from "lucide-react";

export default function CheckoutCancelPage() {
  const search = useSearch();
  const orderCode = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("order") || "";
  }, [search]);

  useEffect(() => {
    if (!orderCode) return;
    apiRequest("POST", `/api/orders/${encodeURIComponent(orderCode)}/cancel`).catch(
      () => undefined,
    );
  }, [orderCode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white">
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <XCircle className="w-16 h-16 text-amber-600 mx-auto mb-4" />
        <h1 className="font-serif text-3xl font-bold mb-2">Đã hủy thanh toán</h1>
        <p className="text-muted-foreground mb-6">
          Bạn có thể quay lại giỏ hàng và thử thanh toán lại.
          {orderCode ? (
            <span className="block mt-2 text-sm font-mono">Đơn: {orderCode}</span>
          ) : null}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/cart">
            <Button>Về giỏ hàng</Button>
          </Link>
          <Link href="/classes">
            <Button variant="outline">Xem lớp học</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
