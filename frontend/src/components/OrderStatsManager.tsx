import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  Download,
  TrendingUp,
  Wallet,
  Percent,
  ShoppingBag,
  CalendarDays,
} from "lucide-react";

type OrderStatsResponse = {
  from: string | null;
  to: string | null;
  revenuePaidVnd: number;
  orderCounts: {
    paid: number;
    pending: number;
    cancelled: number;
    expired: number;
    failed: number;
    all: number;
  };
  last7Days: { orders: number; revenueVnd: number };
  last30Days: { orders: number; revenueVnd: number };
  conversionRate: number;
  topClasses: Array<{
    classSessionId: string;
    title: string;
    enrollmentCount: number;
    revenueVnd: number;
    paidOrderCount: number;
  }>;
  paidOrders: Array<{
    code: string;
    fullName: string;
    phone: string;
    email: string;
    totalVnd: number;
    paidAt: string | null;
    createdAt: string;
    items: string;
  }>;
};

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function downloadCsv(filename: string, rows: string[][]) {
  const bom = "\uFEFF";
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatPct(rate: number): string {
  return `${(rate * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function OrderStatsManager() {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [from, to]);

  const { data, isLoading, isError, refetch } = useQuery<OrderStatsResponse>({
    queryKey: ["/api/admin/orders/stats", from, to],
    queryFn: async () => {
      const url = queryParams
        ? `/api/admin/orders/stats?${queryParams}`
        : "/api/admin/orders/stats";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Không tải được thống kê");
      return res.json();
    },
  });

  const setPreset = (days: number | "all") => {
    if (days === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setFrom(toInputDate(start));
    setTo(toInputDate(end));
  };

  const handleExportCsv = () => {
    if (!data?.paidOrders?.length) {
      toast({
        title: "Không có dữ liệu",
        description: "Chưa có đơn đã thanh toán trong khoảng đã chọn.",
        variant: "destructive",
      });
      return;
    }
    const rows: string[][] = [
      [
        "Mã đơn",
        "Họ tên",
        "SĐT",
        "Email",
        "Lớp",
        "Số tiền (VND)",
        "Thanh toán lúc",
        "Tạo đơn",
      ],
      ...data.paidOrders.map((o) => [
        o.code,
        o.fullName,
        o.phone,
        o.email,
        o.items,
        String(o.totalVnd),
        o.paidAt
          ? new Date(o.paidAt).toLocaleString("vi-VN")
          : "",
        new Date(o.createdAt).toLocaleString("vi-VN"),
      ]),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`doanh-thu-don-hang-${stamp}.csv`, rows);
    toast({
      title: "Đã xuất CSV",
      description: `${data.paidOrders.length} đơn đã thanh toán.`,
    });
  };

  const counts = data?.orderCounts;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Thống kê đơn hàng
            </CardTitle>
            <CardDescription>
              Doanh thu lớp học · PayOS · khoảng lọc theo ngày tạo đơn
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex gap-2">
              <div>
                <Label className="text-xs">Từ ngày</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div>
                <Label className="text-xs">Đến ngày</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-[150px]"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPreset(7)}>
                7 ngày
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPreset(30)}>
                30 ngày
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPreset("all")}>
                Tất cả
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Làm mới
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExportCsv}
                disabled={!data?.paidOrders?.length}
              >
                <Download className="w-4 h-4 mr-1" />
                Xuất CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="py-10 text-center text-red-600">
            Không tải được thống kê đơn hàng
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              icon={<Wallet className="w-5 h-5 text-primary" />}
              label="Doanh thu đã thu"
              value={formatVnd(data.revenuePaidVnd)}
              hint={`${counts?.paid ?? 0} đơn paid trong khoảng lọc`}
            />
            <KpiCard
              icon={<Percent className="w-5 h-5 text-primary" />}
              label="Tỷ lệ chuyển đổi"
              value={formatPct(data.conversionRate)}
              hint="paid / (paid + cancelled + expired)"
            />
            <KpiCard
              icon={<ShoppingBag className="w-5 h-5 text-primary" />}
              label="Tổng đơn (khoảng lọc)"
              value={String(counts?.all ?? 0)}
              hint={`Paid ${counts?.paid ?? 0} · Pending ${counts?.pending ?? 0} · Hủy ${counts?.cancelled ?? 0} · Hết hạn ${counts?.expired ?? 0}`}
            />
            <KpiCard
              icon={<CalendarDays className="w-5 h-5 text-primary" />}
              label="7 ngày gần đây"
              value={formatVnd(data.last7Days.revenueVnd)}
              hint={`${data.last7Days.orders} đơn paid (theo ngày thanh toán)`}
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-primary" />}
              label="30 ngày gần đây"
              value={formatVnd(data.last30Days.revenueVnd)}
              hint={`${data.last30Days.orders} đơn paid (theo ngày thanh toán)`}
            />
            <KpiCard
              icon={<BarChart3 className="w-5 h-5 text-primary" />}
              label="Theo trạng thái"
              value={`${counts?.paid ?? 0} paid`}
              hint={`Pending ${counts?.pending ?? 0} · Failed ${counts?.failed ?? 0}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top lớp bán chạy</CardTitle>
              <CardDescription>
                Theo doanh thu từ đơn đã thanh toán trong khoảng lọc
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.topClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Chưa có dữ liệu lớp trong khoảng này
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Lớp</TableHead>
                        <TableHead>Ghi danh</TableHead>
                        <TableHead>Đơn paid</TableHead>
                        <TableHead>Doanh thu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topClasses.map((row, idx) => (
                        <TableRow key={row.classSessionId}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium max-w-[280px]">
                            <span className="line-clamp-2">{row.title}</span>
                          </TableCell>
                          <TableCell>{row.enrollmentCount}</TableCell>
                          <TableCell>{row.paidOrderCount}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium text-primary">
                            {formatVnd(row.revenueVnd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{hint}</p>
      </CardContent>
    </Card>
  );
}
