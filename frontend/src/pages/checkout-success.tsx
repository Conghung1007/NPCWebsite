import { useEffect, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/hooks/useCart";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { tnjsTrainingHref } from "@/lib/portal";

export default function CheckoutSuccessPage() {
  const search = useSearch();
  const { orderCode, orderType } = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      orderCode: params.get("order") || "",
      orderType: params.get("type") || "class",
    };
  }, [search]);

  const isExamPackage = orderType === "exam-package";

  const apiPath = isExamPackage
    ? `/api/exam-package-orders/${encodeURIComponent(orderCode)}`
    : `/api/orders/${encodeURIComponent(orderCode)}`;

  const { data, refetch, isLoading } = useQuery({
    queryKey: [apiPath],
    enabled: !!orderCode,
    queryFn: async () => {
      const res = await apiFetch(apiPath);
      if (!res.ok) throw new Error("Không tìm thấy đơn");
      return res.json();
    },
    refetchInterval: (q) => {
      const status = (q.state.data as { status?: string })?.status;
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
        <Link href={isExamPackage ? "/" : "/classes"}>
          <Button className="mt-4">Quay lại</Button>
        </Link>
      </div>
    );
  }

  const status = data?.status;
  const amount = isExamPackage ? data?.amountVnd : data?.totalVnd;
  const orderItems = (data?.items || []) as Array<{ itemType?: string; title: string }>;
  const hasExamInOrder =
    isExamPackage || orderItems.some((i) => i.itemType === "exam_package");
  const hasClassInOrder = orderItems.some(
    (i) => !i.itemType || i.itemType === "class",
  );
  const paidMessage =
    hasExamInOrder && hasClassInOrder
      ? "Thanh toán thành công. Quyền thi gói đề đã mở và đăng ký lớp học đã được ghi nhận."
      : hasExamInOrder
        ? "Quyền thi gói đề đã được mở. Bạn có thể làm đầy đủ các đề trong gói."
        : "Cảm ơn bạn đã đăng ký. Trí Nhân Academy sẽ liên hệ xác nhận lịch học.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white">
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        {isLoading && !data ? (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        ) : status === "paid" ? (
          <>
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="font-serif text-3xl font-bold mb-2">Thanh toán thành công</h1>
            <p className="text-muted-foreground mb-6">{paidMessage}</p>
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
            {isExamPackage && data.packageName ? (
              <>
                <p className="text-sm text-muted-foreground">Gói đề</p>
                <p className="font-medium mb-3">{data.packageName}</p>
              </>
            ) : null}
            <p className="text-sm text-muted-foreground">Tổng</p>
            <p className="font-bold text-primary mb-3">
              {amount != null ? formatVnd(amount) : "—"}
            </p>
            {!isExamPackage ? (
              <ul className="text-sm space-y-1">
                {(data.items || []).map((i: { title: string }, idx: number) => (
                  <li key={idx}>• {i.title}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {hasExamInOrder ? (
            <>
              <Link href="/#exam-list">
                <Button>Vào thi ngay</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Trang luyện thi</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/classes">
                <Button variant="outline">Xem lớp khác</Button>
              </Link>
              <a href={tnjsTrainingHref()}>
                <Button>Về trang tiếng Nhật (TNJS)</Button>
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
