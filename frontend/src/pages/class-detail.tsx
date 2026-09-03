import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart, formatVnd } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, MapPin, ShoppingCart } from "lucide-react";
import type { ClassSession } from "@shared/schema";
import { apiFetch } from "@/lib/queryClient";
import { resolvePortal } from "@/lib/portal";

type SessionDetail = ClassSession & {
  courseTitle?: string;
  courseLevel?: string;
  courseDescription?: string | null;
};

interface ClassDetailPageProps {
  id: string;
}

export default function ClassDetailPage({ id }: ClassDetailPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { addItem } = useCart();

  const { data: session, isLoading, isError } = useQuery<SessionDetail>({
    queryKey: ["/api/class-sessions", id, resolvePortal()],
    queryFn: async () => {
      const res = await apiFetch(`/api/class-sessions/${id}`);
      if (!res.ok) throw new Error("Không tìm thấy lớp");
      return res.json();
    },
  });

  const handleAdd = async () => {
    if (!session) return;
    try {
      await addItem.mutateAsync(session.id);
      toast({ title: "Đã thêm vào giỏ hàng" });
    } catch (e: any) {
      toast({
        title: "Không thêm được",
        description: e?.message || "Thử lại sau",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-semibold mb-2">Không tìm thấy lớp học</h1>
        <Button onClick={() => setLocation("/classes")}>Về danh sách lớp</Button>
      </div>
    );
  }

  const seatsLeft = Math.max(
    0,
    session.capacity - session.enrolledCount - session.reservedCount,
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => setLocation("/classes")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tất cả lớp
        </Button>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {session.courseLevel && <Badge>{session.courseLevel}</Badge>}
          {session.courseTitle && (
            <span className="text-sm text-muted-foreground">{session.courseTitle}</span>
          )}
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          {session.title}
        </h1>

        <p className="text-2xl font-bold text-primary mb-6">{formatVnd(session.priceVnd)}</p>

        <div className="space-y-3 mb-8 text-gray-700">
          {session.scheduleText && (
            <p className="flex gap-2">
              <Calendar className="w-5 h-5 text-primary shrink-0" />
              {session.scheduleText}
            </p>
          )}
          {session.locationNote && (
            <p className="flex gap-2">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              {session.locationNote}
            </p>
          )}
          {session.startDate && (
            <p className="text-sm text-muted-foreground">
              Khai giảng:{" "}
              {new Date(session.startDate).toLocaleDateString("vi-VN")}
              {session.endDate
                ? ` — Kết thúc: ${new Date(session.endDate).toLocaleDateString("vi-VN")}`
                : ""}
            </p>
          )}
          <p className="text-sm">Còn {seatsLeft} / {session.capacity} chỗ</p>
        </div>

        {(session.courseDescription || true) && (
          <div className="prose prose-sm max-w-none mb-10 text-gray-600">
            <p>{session.courseDescription || "Đăng ký lớp để nhận lịch học chi tiết và tài liệu từ Trí Nhân Academy."}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            className="sm:flex-1"
            onClick={handleAdd}
            disabled={addItem.isPending || seatsLeft <= 0}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {seatsLeft <= 0 ? "Hết chỗ" : "Thêm vào giỏ"}
          </Button>
          <Link href="/checkout">
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={async (e) => {
                if (seatsLeft <= 0) {
                  e.preventDefault();
                  return;
                }
                try {
                  await addItem.mutateAsync(session.id);
                } catch {
                  /* may already be in cart */
                }
              }}
            >
              Đăng ký ngay
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
