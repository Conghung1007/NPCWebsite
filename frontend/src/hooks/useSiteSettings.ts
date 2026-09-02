import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import type { PortalId } from "@/lib/portal";
import type { SiteSettingsInput } from "@shared/siteSettings";

export type SiteSettings = SiteSettingsInput & { portal: PortalId };

export function useSiteSettings(portal: PortalId) {
  return useQuery<SiteSettings>({
    queryKey: ["/api/site-settings", portal],
    queryFn: async () => {
      const res = await apiFetch(`/api/site-settings?portal=${encodeURIComponent(portal)}`);
      if (!res.ok) throw new Error("Failed to load site settings");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useSaveSiteSettings(portal: PortalId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SiteSettingsInput) => {
      const res = await apiRequest("PUT", "/api/admin/site-settings", {
        ...payload,
        portal,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
    },
  });
}

export type DashboardSummary = {
  unreadMessages: number;
  pendingOrders: number;
  paidOrders: number;
  todayViews: number;
  monthViews: number;
  analytics: {
    month: string;
    totalViews: number;
    daily: Array<{ day: number; views: number }>;
  };
};

export function useAdminDashboardSummary(portal: string | "all") {
  const q =
    portal && portal !== "all"
      ? `?portal=${encodeURIComponent(portal)}`
      : "";
  return useQuery<DashboardSummary>({
    queryKey: ["/api/admin/dashboard-summary", portal],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/dashboard-summary${q}`);
      if (res.status === 404) {
        throw new Error(
          "API bảng điều khiển chưa sẵn sàng — hãy khởi động lại backend (npm run dev:backend).",
        );
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Không tải được dữ liệu tổng quan");
      }
      return res.json();
    },
    refetchInterval: 60_000,
  });
}
