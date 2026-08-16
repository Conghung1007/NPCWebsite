import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { formatVnd } from "@/hooks/useCart";
import type { Order, OrderItem } from "@shared/schema";
import { Receipt } from "lucide-react";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import { portalBadgeLabel } from "@/components/AdminPortalFilter";
import { apiFetch } from "@/lib/queryClient";

type OrderRow = Order & { items: OrderItem[] };

const PAGE_SIZE = 15;

export function OrdersManager() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const { listQuery } = useAdminPortal();

  const { data, isLoading } = useQuery<{ items: OrderRow[]; total: number }>({
    queryKey: ["/api/admin/orders", status, page, listQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (status !== "all") params.set("status", status);
      const q = listQuery.includes("=") ? listQuery.split("=") : null;
      if (q?.[0] === "all") params.set("all", "1");
      else if (q?.[0] === "portal" && q[1]) params.set("portal", q[1]);
      const res = await apiFetch(`/api/admin/orders?${params}`);
      if (!res.ok) throw new Error("Không tải đơn hàng");
      return res.json();
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusBadge = (s: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      pending: "secondary",
      cancelled: "outline",
      expired: "outline",
      failed: "destructive",
    };
    const label: Record<string, string> = {
      paid: "Đã thanh toán",
      pending: "Chờ thanh toán",
      cancelled: "Đã hủy",
      expired: "Hết hạn",
      failed: "Thất bại",
    };
    return <Badge variant={map[s] || "secondary"}>{label[s] || s}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Đơn hàng lớp học
          </CardTitle>
          <CardDescription>{total} đơn · PayOS / ghi danh</CardDescription>
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="pending">Chờ thanh toán</SelectItem>
            <SelectItem value="paid">Đã thanh toán</SelectItem>
            <SelectItem value="cancelled">Đã hủy</SelectItem>
            <SelectItem value="expired">Hết hạn</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Chưa có đơn hàng</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Khách</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Tổng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.code}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{portalBadgeLabel(o.portal)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{o.fullName}</div>
                        <div className="text-xs text-muted-foreground">{o.phone}</div>
                        <div className="text-xs text-muted-foreground">{o.email}</div>
                      </TableCell>
                      <TableCell className="max-w-[200px] text-sm">
                        {o.items.map((i) => i.title).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatVnd(o.totalVnd)}</TableCell>
                      <TableCell>{statusBadge(o.status)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString("vi-VN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
