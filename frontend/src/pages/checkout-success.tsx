import { useEffect, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/hooks/useCart";
import { CheckCircle, Clock, XCircle } from "lucide-react";

export default function CheckoutSuccessPage() {
  const search = useSearch();
  const orderCode = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("order") || "";
  }, [search]);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["/api/orders", orderCode],
    enabled: !!orderCode,
    queryFn: async () => {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Không tìm thấy đơn");
      return res.json();
    },
    refetchInterval: (q) => {
      const status = (q.state.data as any)?.status;
      return status === "pending" ? 3000 : false;
    },
  });

  useEffect(() => {
    if (orderCode) refetch();
  }, [orderCode, refetch]);

  if (!orderCode) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p>Thiếu mã đơn hàng</p>
        <Link href="/classes">
          <Button className="mt-4">Về lớp học</Button>
        </Link>
      </div>
    );
  }

  const status = data?.status;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white">
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        {isLoading && !data ? (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        ) : status === "paid" ? (
          <>
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="font-serif text-3xl font-bold mb-2">Thanh toán thành công</h1>
            <p className="text-muted-foreground mb-6">
              Cảm ơn bạn đã đăng ký. N&P sẽ liên hệ xác nhận lịch học.
            </p>
          </>
        ) : status === "pending" ? (
          <>
            <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="font-serif text-3xl font-bold mb-2">Đang chờ thanh toán</h1>
            <p className="text-muted-foreground mb-6">
              Nếu bạn vừa thanh toán trên PayOS, kết quả sẽ cập nhật trong giây lát…
            </p>
          </>
        ) : (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="font-serif text-3xl font-bold mb-2">Đơn chưa hoàn tất</h1>
            <p className="text-muted-foreground mb-6">
              Trạng thái: {status || "không xác định"}
            </p>
          </>
        )}

        {data && (
          <div className="text-left border border-emerald-100 bg-white p-5 mb-6">
            <p className="text-sm text-muted-foreground">Mã đơn</p>
            <p className="font-mono font-medium mb-3">{data.code}</p>
            <p className="text-sm text-muted-foreground">Tổng</p>
            <p className="font-bold text-primary mb-3">{formatVnd(data.totalVnd)}</p>
            <ul className="text-sm space-y-1">
              {(data.items || []).map((i: any, idx: number) => (
                <li key={idx}>• {i.title}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/classes">
            <Button variant="outline">Xem lớp khác</Button>
          </Link>
          <Link href="/japanese-training">
            <Button>Về trang tiếng Nhật</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
