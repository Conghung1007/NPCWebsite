import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminDashboardSummary } from "@/hooks/useSiteSettings";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import {
  BarChart3,
  Eye,
  MessageSquare,
  Receipt,
  ExternalLink,
  LayoutTemplate,
} from "lucide-react";

type AdminDashboardProps = {
  onNavigate: (tab: string) => void;
};

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { filter } = useAdminPortal();
  const { data, isLoading, isError, error } = useAdminDashboardSummary(filter);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">Đang tải bảng điều khiển…</p>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-sm text-destructive">
          Không tải được dữ liệu tổng quan.
        </p>
        {error instanceof Error && error.message ? (
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {error.message}
          </p>
        ) : null}
      </div>
    );
  }

  const chartData = data.analytics.daily.map((d) => ({
    name: String(d.day),
    views: d.views,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" /> Tin nhắn chưa đọc
            </CardDescription>
            <CardTitle className="text-3xl">{data.unreadMessages}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" onClick={() => onNavigate("messages")}>
              Xem tin nhắn
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Receipt className="h-4 w-4" /> Đơn chờ thanh toán
            </CardDescription>
            <CardTitle className="text-3xl">{data.pendingOrders}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" onClick={() => onNavigate("orders")}>
              Quản lý đơn
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> Lượt xem hôm nay
            </CardDescription>
            <CardTitle className="text-3xl">{data.todayViews}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Tháng này: {data.monthViews.toLocaleString("vi-VN")} lượt
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Đơn đã thanh toán
            </CardDescription>
            <CardTitle className="text-3xl">{data.paidOrders}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" onClick={() => onNavigate("stats")}>
              Thống kê chi tiết
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thống kê truy cập — tháng {data.analytics.month}</CardTitle>
          <CardDescription>
            Số lượt xem trang theo ngày (TNJS-style analytics)
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${v} lượt`, "Truy cập"]}
                labelFormatter={(l) => `Ngày ${l}`}
              />
              <Bar dataKey="views" fill="#00A651" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lối tắt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onNavigate("page-content")}>
            <LayoutTemplate className="h-4 w-4 mr-1.5" />
            Nội dung trang
          </Button>
          <Button variant="secondary" onClick={() => onNavigate("site-settings")}>
            Cấu hình chung
          </Button>
          <Button variant="secondary" onClick={() => onNavigate("articles")}>
            Bài viết
          </Button>
          <Button variant="outline" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Xem website
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
