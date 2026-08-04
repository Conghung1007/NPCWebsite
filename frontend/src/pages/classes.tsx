import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart, formatVnd } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, ShoppingCart, ArrowRight } from "lucide-react";
import type { ClassSession } from "@shared/schema";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SessionRow = ClassSession & { courseTitle?: string; courseLevel?: string };

export default function ClassesPage() {
  const { toast } = useToast();
  const { addItem } = useCart();
  const [level, setLevel] = useState("all");

  const { data: sessions = [], isLoading } = useQuery<SessionRow[]>({
    queryKey: ["/api/class-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/class-sessions", { credentials: "include" });
      if (!res.ok) throw new Error("Không tải lớp học");
      return res.json();
    },
  });

  const levels = Array.from(
    new Set(sessions.map((s) => s.courseLevel).filter(Boolean) as string[]),
  );

  const filtered =
    level === "all"
      ? sessions
      : sessions.filter((s) => s.courseLevel === level);

  const handleAdd = async (id: string) => {
    try {
      await addItem.mutateAsync(id);
      toast({ title: "Đã thêm vào giỏ hàng" });
    } catch (e: any) {
      toast({
        title: "Không thêm được",
        description: e?.message || "Thử lại sau",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-medium text-primary mb-2">Đào tạo tiếng Nhật</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900">
              Lớp đang tuyển sinh
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl">
              Chọn lớp phù hợp lịch và cấp độ — thanh toán online qua PayOS.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Cấp độ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả cấp</SelectItem>
                {levels.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/cart">
              <Button variant="outline">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Giỏ hàng
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Chưa có lớp đang mở</p>
            <p className="text-sm mt-1">Vui lòng quay lại sau hoặc liên hệ tư vấn.</p>
            <Link href="/contact">
              <Button className="mt-6">Tư vấn miễn phí</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <article
                key={s.id}
                className="flex flex-col border border-emerald-100 bg-white/90 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  {s.courseLevel && <Badge variant="secondary">{s.courseLevel}</Badge>}
                  <span className="text-lg font-bold text-primary">{formatVnd(s.priceVnd)}</span>
                </div>
                <h2 className="font-serif text-xl font-semibold text-gray-900 mb-1">
                  <Link href={`/classes/${s.id}`} className="hover:text-primary">
                    {s.title}
                  </Link>
                </h2>
                {s.courseTitle && (
                  <p className="text-sm text-muted-foreground mb-3">{s.courseTitle}</p>
                )}
                {s.scheduleText && (
                  <p className="text-sm flex items-start gap-2 text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    {s.scheduleText}
                  </p>
                )}
                {s.locationNote && (
                  <p className="text-sm flex items-start gap-2 text-gray-700 mb-3">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    {s.locationNote}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mb-4">
                  Còn {Math.max(0, s.capacity - s.enrolledCount - s.reservedCount)} / {s.capacity} chỗ
                </p>
                <div className="mt-auto flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleAdd(s.id)}
                    disabled={addItem.isPending}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Thêm giỏ
                  </Button>
                  <Link href={`/classes/${s.id}`}>
                    <Button variant="outline" size="icon">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
